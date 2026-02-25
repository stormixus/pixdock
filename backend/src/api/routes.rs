use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::docker::client::DockerClient;

pub async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn get_nodes(
    State(docker): State<Arc<DockerClient>>,
) -> Result<Json<Value>, StatusCode> {
    match docker.list_nodes().await {
        Ok(nodes) => Ok(Json(json!(nodes))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_services(
    State(docker): State<Arc<DockerClient>>,
) -> Result<Json<Value>, StatusCode> {
    match docker.list_services().await {
        Ok(services) => Ok(Json(json!(services))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_containers(
    State(docker): State<Arc<DockerClient>>,
) -> Result<Json<Value>, StatusCode> {
    match docker.list_containers().await {
        Ok(containers) => Ok(Json(json!(containers))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_tasks(
    State(docker): State<Arc<DockerClient>>,
    Path(service_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match docker.list_tasks(&service_id).await {
        Ok(tasks) => Ok(Json(json!(tasks))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
pub struct ScaleRequest {
    pub replicas: u64,
}

pub async fn scale_service(
    State(docker): State<Arc<DockerClient>>,
    Path(service_id): Path<String>,
    Json(payload): Json<ScaleRequest>,
) -> Result<Json<Value>, StatusCode> {
    match docker.scale_service(&service_id, payload.replicas).await {
        Ok(()) => Ok(Json(json!({"status": "ok", "replicas": payload.replicas}))),
        Err(e) => {
            tracing::error!("Scale failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
pub struct ContainerAction {
    pub action: String,
}

pub async fn container_action(
    State(docker): State<Arc<DockerClient>>,
    Path(container_id): Path<String>,
    Json(payload): Json<ContainerAction>,
) -> Result<Json<Value>, StatusCode> {
    let result = match payload.action.as_str() {
        "start" => docker.start_container(&container_id).await,
        "stop" => docker.stop_container(&container_id).await,
        "restart" => docker.restart_container(&container_id).await,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    match result {
        Ok(()) => Ok(Json(json!({"status": "ok", "action": payload.action}))),
        Err(e) => {
            tracing::error!("Container action failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
