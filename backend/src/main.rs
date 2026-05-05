use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::Notify;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::EnvFilter;

use pixdock::cache::DockerCache;
use pixdock::docker::DockerClient;
use pixdock::ratelimit::IpRateLimitLayer;
use pixdock::state::AppState;
use pixdock::ws::handler::Broadcaster;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("pixdock=info".parse().unwrap()),
        )
        .init();

    // Check Docker socket availability
    let socket_path = "/var/run/docker.sock";
    if !std::path::Path::new(socket_path).exists() {
        tracing::error!("Docker socket not found at {}", socket_path);
        tracing::error!("Mount it with: -v /var/run/docker.sock:/var/run/docker.sock");
        std::process::exit(1);
    }

    let api_version = DockerClient::detect_api_version().await;
    tracing::info!("Docker API base path: {}", api_version);
    let docker = Arc::new(DockerClient::new(api_version));
    let poll_interval_secs = read_poll_interval_secs();
    let read_only_mode = read_bool_env("PIXDOCK_READ_ONLY");

    // Create cache and notification channel
    let cache: Option<Arc<DockerCache>> = if read_bool_env("PIXDOCK_CACHE_DISABLED") {
        tracing::info!("Docker API cache disabled");
        None
    } else {
        tracing::info!("Docker API cache enabled (2s/5s TTL)");
        Some(Arc::new(DockerCache::new(256)))
    };
    let notify = Arc::new(Notify::new());

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

    if read_only_mode {
        tracing::info!(
            "Read-only mode enabled (PIXDOCK_READ_ONLY=true): mutating APIs are disabled"
        );
    }
    tracing::info!("Dashboard poll interval: {}s", poll_interval_secs);

    // Initialize metrics and audit
    let _metrics = pixdock::metrics::init_metrics();
    let audit_tx = pixdock::audit::spawn_audit_writer();

    // Create shared broadcaster with delta + cache + notify support
    let broadcaster = Broadcaster::new(
        docker.clone(),
        cache.clone(),
        notify.clone(),
        poll_interval_secs,
    );

    let app_state = AppState {
        docker,
        broadcaster,
        cache,
        notify,
        audit_tx,
    };

    let action_routes = Router::new()
        .route(
            "/api/services/{id}/scale",
            post(pixdock::api::routes::scale_service),
        )
        .route(
            "/api/containers/{id}/action",
            post(pixdock::api::routes::container_action),
        )
        .route(
            "/api/images/{id}",
            delete(pixdock::api::routes::delete_image),
        )
        .layer(IpRateLimitLayer::per_minute(30));

    // Protected routes (require auth)
    let mut protected = Router::new()
        .route("/api/nodes", get(pixdock::api::routes::get_nodes))
        .route("/api/services", get(pixdock::api::routes::get_services))
        .route(
            "/api/containers",
            get(pixdock::api::routes::get_containers),
        )
        .route(
            "/api/services/{id}/tasks",
            get(pixdock::api::routes::get_tasks),
        )
        .route(
            "/api/containers/{id}/logs",
            get(pixdock::api::routes::get_container_logs),
        )
        .route(
            "/api/containers/{id}/logs/stream",
            get(pixdock::api::routes::stream_container_logs),
        )
        .route(
            "/api/containers/{id}/inspect",
            get(pixdock::api::routes::get_container_inspect),
        )
        .route("/api/images", get(pixdock::api::routes::get_images))
        .route("/api/audit", get(pixdock::api::routes::get_audit_log));

    if !read_only_mode {
        protected = protected.merge(action_routes);
    }
    protected = protected.layer(middleware::from_fn(pixdock::auth::auth_middleware));

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
        .route("/ws", get(pixdock::ws::handler::ws_handler))
        .route("/api/health", get(pixdock::api::routes::health))
        .route("/api/metrics", get(pixdock::api::routes::metrics))
        .merge(protected)
        .fallback_service(ServeDir::new("static"))
        .layer(cors)
        .layer(middleware::from_fn(pixdock::headers::security_headers))
        .with_state(app_state);

    let addr = "0.0.0.0:8420";
    let mode = if is_swarm { "SWARM" } else { "STANDALONE" };
    tracing::info!("PixDock running on http://{} [{}]", addr, mode);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();
}

fn read_poll_interval_secs() -> u64 {
    std::env::var("PIXDOCK_POLL_INTERVAL")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(3)
}

fn read_bool_env(name: &str) -> bool {
    match std::env::var(name) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
        }
        Err(_) => false,
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}
