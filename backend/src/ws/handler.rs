use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tokio::sync::broadcast;

use crate::docker::client::DockerClient;
use crate::docker::containers::Container;
use crate::docker::nodes::SwarmNode;
use crate::docker::services::SwarmService;
use crate::state::AppState;

#[derive(Clone, Serialize)]
pub struct DashboardState {
    pub mode: String,
    pub nodes: Vec<SwarmNode>,
    pub services: Vec<SwarmService>,
    pub containers: Vec<Container>,
    pub timestamp: String,
}

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

/// Shared state broadcaster - polls Docker once, broadcasts to all clients.
pub struct Broadcaster {
    sender: broadcast::Sender<String>,
}

impl Broadcaster {
    pub fn new(docker: Arc<DockerClient>) -> Arc<Self> {
        let (sender, _) = broadcast::channel(16);
        let broadcaster = Arc::new(Self { sender });

        let docker_clone = docker;
        let sender_clone = broadcaster.sender.clone();
        tokio::spawn(async move {
            let is_swarm = docker_clone.is_swarm_mode().await;
            let mut tick = tokio::time::interval(tokio::time::Duration::from_secs(3));

            loop {
                tick.tick().await;
                if let Some(json) = build_state_json(&docker_clone, is_swarm).await {
                    let _ = sender_clone.send(json);
                }
            }
        });

        broadcaster
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> Response {
    // Authenticate WebSocket via query parameter token
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

    // Send initial state immediately
    let is_swarm = state.docker.is_swarm_mode().await;
    if let Some(json) = build_state_json(&state.docker, is_swarm).await {
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

async fn build_state_json(docker: &DockerClient, is_swarm: bool) -> Option<String> {
    let containers = docker.list_containers().await.unwrap_or_default();

    let (nodes, services) = if is_swarm {
        let n = docker.list_nodes().await.unwrap_or_default();
        let s = docker.list_services().await.unwrap_or_default();
        (n, s)
    } else {
        (vec![], vec![])
    };

    let state = DashboardState {
        mode: if is_swarm { "swarm".into() } else { "standalone".into() },
        nodes,
        services,
        containers,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    serde_json::to_string(&state).ok()
}
