mod api;
mod auth;
mod docker;
mod headers;
mod state;
mod ws;

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;

use docker::DockerClient;
use state::AppState;
use ws::handler::Broadcaster;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("pixdock=info".parse().unwrap()))
        .init();

    // Check Docker socket availability
    let socket_path = "/var/run/docker.sock";
    if !std::path::Path::new(socket_path).exists() {
        tracing::error!("Docker socket not found at {}", socket_path);
        tracing::error!("Mount it with: -v /var/run/docker.sock:/var/run/docker.sock");
        std::process::exit(1);
    }

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

    // Log auth status
    match std::env::var("PIXDOCK_TOKEN") {
        Ok(token) if !token.is_empty() => {
            tracing::info!("Authentication enabled (PIXDOCK_TOKEN set)");
        }
        _ => {
            tracing::warn!("Authentication DISABLED (PIXDOCK_TOKEN not set)");
            tracing::warn!("Set PIXDOCK_TOKEN env var to enable bearer token auth");
        }
    }

    // Create shared broadcaster (single polling task for all WS clients)
    let broadcaster = Broadcaster::new(docker.clone());

    let app_state = AppState {
        docker,
        broadcaster,
    };

    // Protected routes (require auth)
    let protected = Router::new()
        .route("/api/nodes", get(api::routes::get_nodes))
        .route("/api/services", get(api::routes::get_services))
        .route("/api/containers", get(api::routes::get_containers))
        .route("/api/services/{id}/tasks", get(api::routes::get_tasks))
        .route("/api/services/{id}/scale", post(api::routes::scale_service))
        .route("/api/containers/{id}/action", post(api::routes::container_action))
        .route("/api/containers/{id}/logs", get(api::routes::get_container_logs))
        .route("/api/images", get(api::routes::get_images))
        .route("/api/images/{id}", delete(api::routes::delete_image))
        .layer(middleware::from_fn(auth::auth_middleware));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ]);

    let app = Router::new()
        // WebSocket (auth handled inside handler via query param)
        .route("/ws", get(ws::handler::ws_handler))
        // Public routes
        .route("/api/health", get(api::routes::health))
        // Protected routes
        .merge(protected)
        // Serve frontend static files
        .fallback_service(ServeDir::new("static"))
        .layer(cors)
        .layer(middleware::from_fn(headers::security_headers))
        .with_state(app_state);

    let addr = "0.0.0.0:8420";
    let mode = if is_swarm { "SWARM" } else { "STANDALONE" };
    tracing::info!("PixDock running on http://{} [{}]", addr, mode);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
