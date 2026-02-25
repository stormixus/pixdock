mod api;
mod docker;
mod ws;

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;

use docker::DockerClient;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("pixdock=info".parse().unwrap()))
        .init();

    let docker = Arc::new(DockerClient::new());

    // Detect mode
    let is_swarm = docker.is_swarm_mode().await;
    if is_swarm {
        match docker.list_nodes().await {
            Ok(nodes) => tracing::info!("Swarm mode: {} nodes", nodes.len()),
            Err(e) => tracing::error!("Swarm API error: {}", e),
        }
    } else {
        match docker.list_containers().await {
            Ok(containers) => tracing::info!("Standalone mode: {} containers", containers.len()),
            Err(e) => {
                tracing::error!("Docker connection failed: {}", e);
                tracing::error!("Make sure /var/run/docker.sock is mounted");
            }
        }
    }

    let app = Router::new()
        // WebSocket
        .route("/ws", get(ws::handler::ws_handler))
        // REST API
        .route("/api/health", get(api::routes::health))
        .route("/api/nodes", get(api::routes::get_nodes))
        .route("/api/services", get(api::routes::get_services))
        .route("/api/containers", get(api::routes::get_containers))
        .route("/api/services/{id}/tasks", get(api::routes::get_tasks))
        .route("/api/services/{id}/scale", post(api::routes::scale_service))
        .route("/api/containers/{id}/action", post(api::routes::container_action))
        // Serve frontend static files
        .fallback_service(ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .with_state(docker);

    let addr = "0.0.0.0:8420";
    let mode = if is_swarm { "SWARM" } else { "STANDALONE" };
    tracing::info!("PixDock running on http://{} [{}]", addr, mode);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
