use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use subtle::ConstantTimeEq;
use tokio::sync::broadcast;

use crate::docker::client::DockerClient;
use crate::docker::containers::Container;
use crate::docker::nodes::SwarmNode;
use crate::docker::services::SwarmService;
use crate::state::AppState;
use crate::ws::delta;

const FULL_SNAPSHOT_INTERVAL_SECS: u64 = 30;
const DEFAULT_CHANNEL_CAPACITY: usize = 16;

#[derive(Clone, Serialize, Deserialize)]
struct DashboardState {
    mode: String,
    nodes: Vec<SwarmNode>,
    services: Vec<SwarmService>,
    containers: Vec<Container>,
    error: Option<String>,
    timestamp: String,
}

/// Typed envelope for all WS messages.
#[derive(Clone, Serialize)]
struct WsEnvelope {
    #[serde(rename = "type")]
    msg_type: String,
    rev: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<DashboardState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    containers: Option<Vec<Container>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    services: Option<Vec<SwarmService>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nodes: Option<Vec<SwarmNode>>,
}

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

/// Snapshot of previous state used to compute deltas.
struct PrevState {
    containers: Vec<Container>,
    services: Vec<SwarmService>,
    nodes: Vec<SwarmNode>,
}

/// Shared state broadcaster with delta support.
pub struct Broadcaster {
    sender: broadcast::Sender<String>,
}

impl Broadcaster {
    pub fn new(
        docker: Arc<DockerClient>,
        cache: Option<Arc<crate::cache::DockerCache>>,
        notify: Arc<tokio::sync::Notify>,
        poll_interval_secs: u64,
    ) -> Arc<Self> {
        let capacity = read_channel_capacity();
        let (sender, _) = broadcast::channel(capacity);
        let broadcaster = Arc::new(Self { sender });

        let sender_clone = broadcaster.sender.clone();
        tokio::spawn(async move {
            let is_swarm = docker.is_swarm_mode().await;
            let interval_secs = poll_interval_secs.max(1);
            let mut tick = tokio::time::interval(Duration::from_secs(interval_secs));
            let mut revision: u64 = 0;
            let mut last_full_snapshot = tokio::time::Instant::now();
            let mut prev_state: Option<PrevState> = None;

            // Force a full snapshot on first tick
            last_full_snapshot -=
                Duration::from_secs(FULL_SNAPSHOT_INTERVAL_SECS + 1);

            loop {
                tokio::select! {
                    _ = tick.tick() => {},
                    _ = notify.notified() => {
                        // Mutating action triggered immediate broadcast
                        tracing::debug!("Immediate broadcast triggered by notify");
                    },
                }

                let state = build_state(&docker, cache.as_deref(), is_swarm).await;
                let now = tokio::time::Instant::now();
                let need_full = now
                    .duration_since(last_full_snapshot)
                    .as_secs()
                    >= FULL_SNAPSHOT_INTERVAL_SECS;

                revision += 1;

                if need_full {
                    // Update prev_state directly (avoid JSON round-trip via serialize/deserialize)
                    prev_state = Some(PrevState {
                        containers: state.containers.clone(),
                        services: state.services.clone(),
                        nodes: state.nodes.clone(),
                    });

                    let envelope = WsEnvelope {
                        msg_type: "full".to_string(),
                        rev: revision,
                        data: Some(state),
                        containers: None,
                        services: None,
                        nodes: None,
                    };
                    if let Ok(json) = serde_json::to_string(&envelope) {
                        let _ = sender_clone.send(json);
                        last_full_snapshot = now;
                    }
                } else {
                    // Use data already fetched in build_state (avoid redundant re-fetches)
                    let curr_containers = state.containers;
                    let curr_services = state.services;
                    let curr_nodes = state.nodes;

                    if let Some(ref prev) = prev_state {
                        let maybe_patch = delta::diff(
                            &prev.containers,
                            &curr_containers,
                            &prev.services,
                            &curr_services,
                            &prev.nodes,
                            &curr_nodes,
                        );

                        if let Some(patch) = maybe_patch {
                            let envelope = WsEnvelope {
                                msg_type: "delta".to_string(),
                                rev: revision,
                                data: None,
                                containers: patch.containers,
                                services: patch.services,
                                nodes: patch.nodes,
                            };
                            if let Ok(json) = serde_json::to_string(&envelope) {
                                let _ = sender_clone.send(json);
                            }
                        }
                        // No change → skip sending (continue to update prev_state)
                    }

                    prev_state = Some(PrevState {
                        containers: curr_containers,
                        services: curr_services,
                        nodes: curr_nodes,
                    });
                }
            }
        });

        broadcaster
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }
}

fn read_channel_capacity() -> usize {
    std::env::var("PIXDOCK_WS_CHANNEL_CAPACITY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(DEFAULT_CHANNEL_CAPACITY)
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> Response {
    if let Ok(expected) = std::env::var("PIXDOCK_TOKEN") {
        if !expected.is_empty() {
            match &query.token {
                Some(token) if bool::from(token.as_bytes().ct_eq(expected.as_bytes())) => {}
                _ => return StatusCode::UNAUTHORIZED.into_response(),
            }
        }
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.broadcaster.subscribe();

    // Send initial state as a full snapshot immediately
    let is_swarm = state.docker.is_swarm_mode().await;
    let initial_state =
        build_state(&state.docker, state.cache.as_deref(), is_swarm).await;
    let initial_envelope = WsEnvelope {
        msg_type: "full".to_string(),
        rev: 0,
        data: Some(initial_state),
        containers: None,
        services: None,
        nodes: None,
    };
    if let Ok(json) = serde_json::to_string(&initial_envelope) {
        if sender.send(Message::Text(json.into())).await.is_err() {
            return;
        }
    }

    loop {
        tokio::select! {
            result = rx.recv() => {
                match result {
                    Ok(json) => {
                        if sender.send(Message::Text(json.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("WebSocket client lagged, skipped {} messages", n);
                        // Send a full snapshot to resync
                        let is_swarm = state.docker.is_swarm_mode().await;
                        let state_snap = build_state(
                            &state.docker,
                            state.cache.as_deref(),
                            is_swarm,
                        ).await;
                        let env = WsEnvelope {
                            msg_type: "full".to_string(),
                            rev: 0,
                            data: Some(state_snap),
                            containers: None,
                            services: None,
                            nodes: None,
                        };
                        if let Ok(json) = serde_json::to_string(&env) {
                            if sender.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(data))) => {
                        if sender.send(Message::Pong(data)).await.is_err() {
                            break;
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

/// Build the full DashboardState, using cache where possible.
async fn build_state(
    docker: &DockerClient,
    cache: Option<&crate::cache::DockerCache>,
    is_swarm: bool,
) -> DashboardState {
    let containers = build_containers(docker, cache).await.unwrap_or_default();
    let (nodes, services) = if is_swarm {
        let n = build_nodes(docker, cache).await.unwrap_or_default();
        let s = build_services(docker, cache).await.unwrap_or_default();
        (n, s)
    } else {
        (vec![], vec![])
    };

    DashboardState {
        mode: if is_swarm {
            "swarm".into()
        } else {
            "standalone".into()
        },
        nodes,
        services,
        containers,
        error: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

async fn build_containers(
    docker: &DockerClient,
    cache: Option<&crate::cache::DockerCache>,
) -> Result<Vec<Container>, crate::docker::client::DockerError> {
    let cache_key = "containers:list";
    if let Some(c) = cache.and_then(|c| c.get(cache_key)) {
        return serde_json::from_value(c).map_err(|e| {
            crate::docker::client::DockerError::Parse(e.to_string())
        });
    }
    let containers = docker.list_containers().await?;
    if let Some(c) = cache {
        c.set(
            cache_key.to_string(),
            serde_json::to_value(&containers).unwrap_or_default(),
            Duration::from_secs(2),
        );
    }
    Ok(containers)
}

async fn build_services(
    docker: &DockerClient,
    cache: Option<&crate::cache::DockerCache>,
) -> Result<Vec<SwarmService>, crate::docker::client::DockerError> {
    let cache_key = "services:list";
    if let Some(c) = cache.and_then(|c| c.get(cache_key)) {
        return serde_json::from_value(c).map_err(|e| {
            crate::docker::client::DockerError::Parse(e.to_string())
        });
    }
    let services = docker.list_services().await?;
    if let Some(c) = cache {
        c.set(
            cache_key.to_string(),
            serde_json::to_value(&services).unwrap_or_default(),
            Duration::from_secs(5),
        );
    }
    Ok(services)
}

async fn build_nodes(
    docker: &DockerClient,
    cache: Option<&crate::cache::DockerCache>,
) -> Result<Vec<SwarmNode>, crate::docker::client::DockerError> {
    let cache_key = "nodes:list";
    if let Some(c) = cache.and_then(|c| c.get(cache_key)) {
        return serde_json::from_value(c).map_err(|e| {
            crate::docker::client::DockerError::Parse(e.to_string())
        });
    }
    let nodes = docker.list_nodes().await?;
    if let Some(c) = cache {
        c.set(
            cache_key.to_string(),
            serde_json::to_value(&nodes).unwrap_or_default(),
            Duration::from_secs(5),
        );
    }
    Ok(nodes)
}

#[cfg(test)]
mod tests {}
