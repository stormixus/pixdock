use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::state::AppState;

#[derive(Deserialize)]
pub struct LogsQuery {
    pub tail: Option<u32>,
    pub timestamps: Option<bool>,
}

/// Validate a Docker resource ID (container ID, service ID, or name).
fn validate_docker_id(id: &str) -> Result<(), (StatusCode, Json<Value>)> {
    if id.is_empty() || id.len() > 128 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid resource ID: length must be 1-128 characters"})),
        ));
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid resource ID: only alphanumeric, hyphens, underscores, and dots allowed"})),
        ));
    }
    Ok(())
}

pub async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn get_nodes(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match state.docker.list_nodes().await {
        Ok(nodes) => Ok(Json(json!(nodes))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to list nodes: {}", e)})),
        )),
    }
}

pub async fn get_services(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match state.docker.list_services().await {
        Ok(services) => Ok(Json(json!(services))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to list services: {}", e)})),
        )),
    }
}

pub async fn get_containers(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match state.docker.list_containers().await {
        Ok(containers) => Ok(Json(json!(containers))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to list containers: {}", e)})),
        )),
    }
}

pub async fn get_tasks(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&service_id)?;
    match state.docker.list_tasks(&service_id).await {
        Ok(tasks) => Ok(Json(json!(tasks))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to list tasks: {}", e)})),
        )),
    }
}

#[derive(Deserialize)]
pub struct ScaleRequest {
    pub replicas: u64,
}

const MAX_REPLICAS: u64 = 1000;

pub async fn scale_service(
    State(state): State<AppState>,
    Path(service_id): Path<String>,
    Json(payload): Json<ScaleRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&service_id)?;
    if payload.replicas > MAX_REPLICAS {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": format!("Replicas must be <= {}", MAX_REPLICAS)})),
        ));
    }
    match state.docker.scale_service(&service_id, payload.replicas).await {
        Ok(()) => Ok(Json(json!({"status": "ok", "replicas": payload.replicas}))),
        Err(e) => {
            tracing::error!("Scale failed: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to scale service: {}", e)})),
            ))
        }
    }
}

#[derive(Deserialize)]
pub struct ContainerActionRequest {
    pub action: String,
}

pub async fn get_container_logs(
    State(state): State<AppState>,
    Path(container_id): Path<String>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&container_id)?;
    let tail = query.tail.unwrap_or(200).min(5000);
    let timestamps = query.timestamps.unwrap_or(true);
    match state.docker.get_logs(&container_id, tail, timestamps).await {
        Ok(lines) => Ok(Json(json!({"lines": lines}))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to get logs: {}", e)})),
        )),
    }
}

pub async fn container_action(
    State(state): State<AppState>,
    Path(container_id): Path<String>,
    Json(payload): Json<ContainerActionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&container_id)?;
    let result = match payload.action.as_str() {
        "start" => state.docker.start_container(&container_id).await,
        "stop" => state.docker.stop_container(&container_id).await,
        "restart" => state.docker.restart_container(&container_id).await,
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Unknown action: {}", payload.action)})),
            ))
        }
    };

    match result {
        Ok(()) => Ok(Json(json!({"status": "ok", "action": payload.action}))),
        Err(e) => {
            tracing::error!("Container action failed: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Container action failed: {}", e)})),
            ))
        }
    }
}

pub async fn get_images(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match state.docker.list_images().await {
        Ok(images) => Ok(Json(json!(images))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to list images: {}", e)})),
        )),
    }
}

pub async fn delete_image(
    State(state): State<AppState>,
    Path(image_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&image_id)?;
    match state.docker.delete_image(&image_id).await {
        Ok(()) => Ok(Json(json!({"status": "ok"}))),
        Err(e) => {
            tracing::error!("Image delete failed: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to delete image: {}", e)})),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(id: &str) -> bool {
        validate_docker_id(id).is_ok()
    }

    fn err(id: &str) -> bool {
        validate_docker_id(id).is_err()
    }

    // --- valid inputs ---

    #[test]
    fn test_valid_alphanumeric() {
        assert!(ok("abc123"));
    }

    #[test]
    fn test_valid_hyphen() {
        assert!(ok("my-container"));
    }

    #[test]
    fn test_valid_underscore_and_dot() {
        assert!(ok("my_container.v2"));
    }

    #[test]
    fn test_valid_single_char() {
        assert!(ok("a"));
    }

    #[test]
    fn test_valid_max_length() {
        let s = "a".repeat(128);
        assert!(ok(&s));
    }

    // --- invalid inputs ---

    #[test]
    fn test_invalid_empty() {
        assert!(err(""));
    }

    #[test]
    fn test_invalid_too_long() {
        let s = "a".repeat(129);
        assert!(err(&s));
    }

    #[test]
    fn test_invalid_slash() {
        assert!(err("abc/def"));
    }

    #[test]
    fn test_invalid_space() {
        assert!(err("abc def"));
    }

    #[test]
    fn test_invalid_semicolon() {
        assert!(err("abc;rm"));
    }

    #[test]
    fn test_invalid_newline() {
        assert!(err("test\ninjection"));
    }

    #[test]
    fn test_invalid_angle_brackets() {
        assert!(err("<script>"));
    }
}
