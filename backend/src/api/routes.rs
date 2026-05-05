use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use futures::stream;
use http_body_util::BodyExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::convert::Infallible;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::audit::{self, AuditEvent};
use crate::metrics;
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
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(
                json!({"error": "Invalid resource ID: only alphanumeric, hyphens, underscores, and dots allowed"}),
            ),
        ));
    }
    Ok(())
}

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    let start = std::time::Instant::now();
    match state.docker.list_containers().await {
        Ok(_) => {
            let elapsed_ms = start.elapsed().as_millis() as u64;
            Json(json!({
                "status": "ok",
                "docker": {"connected": true},
                "latency_ms": elapsed_ms,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))
        }
        Err(e) => Json(json!({
            "status": "degraded",
            "docker": {
                "connected": false,
                "error": e.to_string()
            },
            "timestamp": chrono::Utc::now().to_rfc3339()
        })),
    }
}

pub async fn metrics() -> impl IntoResponse {
    let body = metrics::get_metrics().render();
    (
        StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        body,
    )
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

pub async fn get_container_inspect(
    State(state): State<AppState>,
    Path(container_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&container_id)?;
    match state.docker.inspect_container(&container_id).await {
        Ok(inspect) => Ok(Json(inspect)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to inspect container: {}", e)})),
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
    match state
        .docker
        .scale_service(&service_id, payload.replicas)
        .await
    {
        Ok(()) => {
            emit_audit(&state.audit_tx, "scale", "service", &service_id).await;
            invalidate_cache_and_notify(&state, "services");
            Ok(Json(json!({"status": "ok", "replicas": payload.replicas})))
        }
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

pub async fn stream_container_logs(
    State(state): State<AppState>,
    Path(container_id): Path<String>,
) -> Result<Sse<impl futures::Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<Value>)>
{
    validate_docker_id(&container_id)?;

    let mut body = state
        .docker
        .stream_logs(&container_id, 100, true)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to stream logs: {}", e)})),
            )
        })?;

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(32);

    tokio::spawn(async move {
        let mut mode = LogStreamMode::Unknown;
        let mut multiplexed_buffer = Vec::new();
        let mut text_buffer = String::new();

        while let Some(frame_result) = body.frame().await {
            let frame = match frame_result {
                Ok(frame) => frame,
                Err(err) => {
                    let _ = tx
                        .send(Ok(Event::default()
                            .event("error")
                            .data(format!("Docker log stream error: {}", err))))
                        .await;
                    return;
                }
            };

            let Some(chunk) = frame.data_ref() else {
                continue;
            };
            if chunk.is_empty() {
                continue;
            }

            match mode {
                LogStreamMode::Unknown => {
                    multiplexed_buffer.extend_from_slice(chunk);
                    if multiplexed_buffer.len() >= 8 {
                        if looks_like_multiplexed_header(&multiplexed_buffer) {
                            mode = LogStreamMode::Multiplexed;
                            while let Some(line) = take_multiplexed_line(&mut multiplexed_buffer) {
                                if !line.is_empty()
                                    && tx.send(Ok(Event::default().data(line))).await.is_err()
                                {
                                    return;
                                }
                            }
                        } else {
                            mode = LogStreamMode::PlainText;
                            text_buffer.push_str(&String::from_utf8_lossy(&multiplexed_buffer));
                            multiplexed_buffer.clear();
                            while let Some(newline_index) = text_buffer.find('\n') {
                                let line = text_buffer[..newline_index]
                                    .trim_end_matches('\r')
                                    .to_string();
                                text_buffer.drain(..=newline_index);
                                if !line.is_empty()
                                    && tx.send(Ok(Event::default().data(line))).await.is_err()
                                {
                                    return;
                                }
                            }
                        }
                    }
                }
                LogStreamMode::Multiplexed => {
                    multiplexed_buffer.extend_from_slice(chunk);
                    while let Some(line) = take_multiplexed_line(&mut multiplexed_buffer) {
                        if !line.is_empty()
                            && tx.send(Ok(Event::default().data(line))).await.is_err()
                        {
                            return;
                        }
                    }
                }
                LogStreamMode::PlainText => {
                    text_buffer.push_str(&String::from_utf8_lossy(chunk));
                    while let Some(newline_index) = text_buffer.find('\n') {
                        let line = text_buffer[..newline_index]
                            .trim_end_matches('\r')
                            .to_string();
                        text_buffer.drain(..=newline_index);
                        if !line.is_empty()
                            && tx.send(Ok(Event::default().data(line))).await.is_err()
                        {
                            return;
                        }
                    }
                }
            }
        }

        if matches!(mode, LogStreamMode::Unknown) && !multiplexed_buffer.is_empty() {
            text_buffer.push_str(&String::from_utf8_lossy(&multiplexed_buffer));
        }

        let trailing = text_buffer.trim_end_matches(&['\r', '\n'][..]).to_string();
        if !trailing.is_empty() {
            let _ = tx.send(Ok(Event::default().data(trailing))).await;
        }
    });

    let stream = stream::unfold(rx, |mut receiver| async {
        receiver.recv().await.map(|item| (item, receiver))
    });

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    ))
}

#[derive(Clone, Copy)]
enum LogStreamMode {
    Unknown,
    Multiplexed,
    PlainText,
}

fn looks_like_multiplexed_header(buffer: &[u8]) -> bool {
    buffer.len() >= 8
        && matches!(buffer[0], 0 | 1 | 2)
        && buffer[1] == 0
        && buffer[2] == 0
        && buffer[3] == 0
}

fn take_multiplexed_line(buffer: &mut Vec<u8>) -> Option<String> {
    if buffer.len() < 8 {
        return None;
    }

    let size = u32::from_be_bytes([buffer[4], buffer[5], buffer[6], buffer[7]]) as usize;
    if buffer.len() < 8 + size {
        return None;
    }

    let payload = buffer[8..8 + size].to_vec();
    buffer.drain(..8 + size);

    Some(
        String::from_utf8_lossy(&payload)
            .trim_end_matches(&['\r', '\n'][..])
            .to_string(),
    )
}

pub async fn container_action(
    State(state): State<AppState>,
    Path(container_id): Path<String>,
    Json(payload): Json<ContainerActionRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    validate_docker_id(&container_id)?;
    let action = payload.action.clone();
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
        Ok(()) => {
            emit_audit(&state.audit_tx, &action, "container", &container_id).await;
            invalidate_cache_and_notify(&state, "containers");
            Ok(Json(json!({"status": "ok", "action": payload.action})))
        }
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
        Ok(()) => {
            emit_audit(&state.audit_tx, "delete", "image", &image_id).await;
            invalidate_cache_and_notify(&state, "images");
            Ok(Json(json!({"status": "ok"})))
        }
        Err(e) => {
            tracing::error!("Image delete failed: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to delete image: {}", e)})),
            ))
        }
    }
}

pub async fn get_audit_log(
    State(_state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let events = audit::query_audit_log(100);
    Ok(Json(json!(events)))
}

/// Send an audit event and log a warning if the channel is full (blocking send).
async fn emit_audit(tx: &mpsc::Sender<AuditEvent>, action: &str, resource_type: &str, resource_id: &str) {
    let token_hash = std::env::var("PIXDOCK_TOKEN")
        .ok()
        .filter(|t| !t.is_empty())
        .map(|t| audit::hash_token(&t))
        .unwrap_or_else(|| "anonymous".to_string());

    let event = AuditEvent {
        action: action.to_string(),
        resource_type: resource_type.to_string(),
        resource_id: resource_id.to_string(),
        token_hash,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    match tx.send(event).await {
        Ok(_) => {}
        Err(e) => {
            tracing::error!("Audit channel closed: {}", e);
        }
    }
}

/// Invalidate cache entries for a prefix and trigger immediate WS broadcast.
fn invalidate_cache_and_notify(state: &AppState, prefix: &str) {
    if let Some(ref cache) = state.cache {
        let removed = cache.invalidate(prefix);
        tracing::debug!(
            "Cache invalidated prefix='{}' (removed {} entries)",
            prefix,
            removed
        );
    }
    state.notify.notify_one();
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
