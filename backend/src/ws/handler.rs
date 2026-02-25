use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use serde::Serialize;
use std::sync::Arc;

use crate::docker::client::DockerClient;
use crate::docker::containers::Container;
use crate::docker::nodes::SwarmNode;
use crate::docker::services::SwarmService;

#[derive(Serialize)]
pub struct DashboardState {
    pub mode: String,
    pub nodes: Vec<SwarmNode>,
    pub services: Vec<SwarmService>,
    pub containers: Vec<Container>,
    pub timestamp: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(docker): State<Arc<DockerClient>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, docker))
}

async fn handle_socket(socket: WebSocket, docker: Arc<DockerClient>) {
    let (mut sender, mut receiver) = socket.split();

    // Poll interval: 3 seconds
    let mut tick = tokio::time::interval(tokio::time::Duration::from_secs(3));

    // Detect mode once at connection start
    let is_swarm = docker.is_swarm_mode().await;

    // Send initial state immediately
    if let Some(msg) = build_state_message(&docker, is_swarm).await {
        if sender.send(msg).await.is_err() {
            return;
        }
    }

    loop {
        tokio::select! {
            _ = tick.tick() => {
                match build_state_message(&docker, is_swarm).await {
                    Some(msg) => {
                        if sender.send(msg).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let err = Message::Text(
                            serde_json::json!({"error": "Failed to fetch Docker state"}).to_string().into()
                        );
                        if sender.send(err).await.is_err() {
                            break;
                        }
                    }
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

async fn build_state_message(docker: &DockerClient, is_swarm: bool) -> Option<Message> {
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

    let json = serde_json::to_string(&state).ok()?;
    Some(Message::Text(json.into()))
}
