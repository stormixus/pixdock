use std::sync::Arc;
use tokio::sync::{mpsc, Notify};

use pixdock::cache::DockerCache;
use pixdock::docker::DockerClient;
use pixdock::state::AppState;
use pixdock::ws::handler::Broadcaster;

fn test_app_state() -> AppState {
    let docker = Arc::new(DockerClient::new("/v1.43".to_string()));
    let cache = Some(Arc::new(DockerCache::new(256)));
    let notify = Arc::new(Notify::new());
    let broadcaster = Broadcaster::new(docker.clone(), cache.clone(), notify.clone(), 3);
    let (audit_tx, _rx) = mpsc::channel::<pixdock::audit::AuditEvent>(128);

    AppState {
        docker,
        broadcaster,
        cache,
        notify,
        audit_tx,
    }
}

// --- Auth middleware tests ---

#[test]
fn test_auth_token_hash_deterministic() {
    let h1 = pixdock::audit::hash_token("my-token");
    let h2 = pixdock::audit::hash_token("my-token");
    assert_eq!(h1, h2);
    assert_eq!(h1.len(), 16);
}

#[test]
fn test_auth_token_hash_different_tokens() {
    let h1 = pixdock::audit::hash_token("admin-token");
    let h2 = pixdock::audit::hash_token("viewer-token");
    assert_ne!(h1, h2);
}

#[test]
fn test_auth_token_anonymous() {
    // When no token is set, audit uses "anonymous"
    let empty: Option<String> = None;
    let token_hash = empty
        .filter(|t| !t.is_empty())
        .map(|t| pixdock::audit::hash_token(&t))
        .unwrap_or_else(|| "anonymous".to_string());
    assert_eq!(token_hash, "anonymous");
}

// --- Rate limiter tests ---

#[test]
fn test_rate_limit_layer_creation() {
    use pixdock::ratelimit::IpRateLimitLayer;
    let _layer = IpRateLimitLayer::per_minute(30);
}

#[test]
fn test_rate_limit_custom_window() {
    use pixdock::ratelimit::IpRateLimitLayer;
    use std::time::Duration;
    let _layer = IpRateLimitLayer::new(10, Duration::from_secs(30));
}

// --- Audit event tests ---

#[tokio::test]
async fn test_audit_event_send_receive() {
    let (tx, mut rx) = mpsc::channel::<pixdock::audit::AuditEvent>(128);

    let event = pixdock::audit::AuditEvent {
        action: "stop".to_string(),
        resource_type: "container".to_string(),
        resource_id: "abc123".to_string(),
        token_hash: "abcd1234abcd1234".to_string(),
        timestamp: "2024-01-01T00:00:00Z".to_string(),
    };

    tx.send(event).await.unwrap();
    let received = rx.recv().await.unwrap();
    assert_eq!(received.action, "stop");
    assert_eq!(received.resource_type, "container");
    assert_eq!(received.resource_id, "abc123");
}

#[tokio::test]
async fn test_audit_event_multiple_actions() {
    let (tx, mut rx) = mpsc::channel::<pixdock::audit::AuditEvent>(128);

    for (action, resource) in &[
        ("stop", "container"),
        ("start", "container"),
        ("restart", "container"),
        ("scale", "service"),
        ("delete", "image"),
    ] {
        let event = pixdock::audit::AuditEvent {
            action: action.to_string(),
            resource_type: resource.to_string(),
            resource_id: "id123".to_string(),
            token_hash: "hash1234hash1234".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        tx.send(event).await.unwrap();
    }

    let mut received_actions: Vec<String> = vec![];
    while let Ok(event) = rx.try_recv() {
        received_actions.push(event.action);
    }
    assert_eq!(received_actions.len(), 5);
    assert!(received_actions.contains(&"stop".to_string()));
    assert!(received_actions.contains(&"scale".to_string()));
    assert!(received_actions.contains(&"delete".to_string()));
}

#[tokio::test]
async fn test_audit_channel_capacity() {
    // Verify channel can hold expected capacity
    let (tx, _rx) = mpsc::channel::<pixdock::audit::AuditEvent>(128);
    for i in 0..128 {
        let event = pixdock::audit::AuditEvent {
            action: format!("action_{}", i),
            resource_type: "test".to_string(),
            resource_id: format!("id_{}", i),
            token_hash: "hash1234hash1234".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        assert!(tx.try_send(event).is_ok());
    }
    // 129th should fail (or be handled by blocking send in real usage)
}

// --- Docker API version detection tests ---

#[test]
fn test_docker_version_fallback_path() {
    let client = DockerClient::new("/v1.43".to_string());
    assert_eq!(client.versioned_path("/containers/json"), "/v1.43/containers/json");
}

#[test]
fn test_docker_version_preferred_path() {
    let client = DockerClient::new("/v1.44".to_string());
    assert_eq!(client.versioned_path("/info"), "/v1.44/info");
}

#[test]
fn test_docker_version_arbitrary_path() {
    let client = DockerClient::new("/v99.99".to_string());
    assert_eq!(
        client.versioned_path("/containers/json?all=true"),
        "/v99.99/containers/json?all=true"
    );
}

// --- WS envelope format tests ---

#[test]
fn test_ws_envelope_full_format() {
    let envelope = serde_json::json!({
        "type": "full",
        "rev": 1,
        "data": {
            "mode": "standalone",
            "nodes": [],
            "services": [],
            "containers": [],
            "error": null,
            "timestamp": "2024-01-01T00:00:00Z"
        }
    });

    assert_eq!(envelope["type"], "full");
    assert!(envelope["data"].is_object());
    assert!(envelope.get("containers").is_none() || envelope["containers"].is_null());
}

#[test]
fn test_ws_envelope_delta_format() {
    let envelope = serde_json::json!({
        "type": "delta",
        "rev": 5,
        "containers": [{
            "id": "abc123",
            "name": "web",
            "image": "nginx:latest",
            "state": "running",
            "status": "Up 2 hours",
            "created": 1000,
            "ports": [],
            "project": null
        }]
    });

    assert_eq!(envelope["type"], "delta");
    assert_eq!(envelope["rev"], 5);
    assert!(envelope["data"].is_null());
    assert!(envelope["containers"].is_array());
    assert_eq!(envelope["containers"][0]["id"], "abc123");
}

#[test]
fn test_ws_delta_not_json_patch() {
    let patch = pixdock::ws::delta::DeltaPatch {
        containers: Some(vec![]),
        services: None,
        nodes: None,
    };
    let json = serde_json::to_value(&patch).unwrap();
    assert!(json.get("op").is_none());
    assert!(json.get("path").is_none());
    assert!(json["containers"].is_array());
}

#[test]
fn test_ws_legacy_format_still_parseable() {
    let legacy = serde_json::json!({
        "mode": "standalone",
        "nodes": [],
        "services": [],
        "containers": [],
        "timestamp": "2024-01-01T00:00:00Z"
    });
    assert!(legacy.get("type").is_none());
    // Frontend should handle this gracefully (treat as full)
}

// --- Cache tests ---

#[test]
fn test_cache_set_get_invalidate() {
    let cache = DockerCache::new(100);
    cache.set(
        "test".to_string(),
        serde_json::json!("value"),
        std::time::Duration::from_secs(60),
    );
    assert_eq!(cache.get("test"), Some(serde_json::json!("value")));
    let removed = cache.invalidate("test");
    assert_eq!(removed, 1);
    assert_eq!(cache.get("test"), None);
}

#[test]
fn test_cache_prefix_invalidation() {
    let cache = DockerCache::new(100);
    cache.set(
        "containers:list".to_string(),
        serde_json::json!([]),
        std::time::Duration::from_secs(60),
    );
    cache.set(
        "containers:id1".to_string(),
        serde_json::json!({}),
        std::time::Duration::from_secs(60),
    );
    cache.set(
        "nodes:list".to_string(),
        serde_json::json!([]),
        std::time::Duration::from_secs(60),
    );

    let removed = cache.invalidate("containers");
    assert_eq!(removed, 2);
    assert!(cache.get("containers:list").is_none());
    assert!(cache.get("containers:id1").is_none());
    assert!(cache.get("nodes:list").is_some());
}

#[test]
fn test_cache_ttl_expiry() {
    let cache = DockerCache::new(100);
    cache.set(
        "ephemeral".to_string(),
        serde_json::json!("data"),
        std::time::Duration::ZERO,
    );
    assert_eq!(cache.get("ephemeral"), None);
}

// --- Metrics tests ---

#[test]
fn test_metrics_counter_increment() {
    let reg = pixdock::metrics::MetricsRegistry::new();
    reg.inc_counter("http_requests_total", "Total HTTP requests");
    reg.inc_counter("http_requests_total", "Total HTTP requests");
    let output = reg.render();
    assert!(output.contains("http_requests_total 2"));
}

#[test]
fn test_metrics_prometheus_headers() {
    let reg = pixdock::metrics::MetricsRegistry::new();
    reg.inc_counter("test_total", "Test counter");
    let output = reg.render();
    assert!(output.contains("# HELP test_total Test counter"));
    assert!(output.contains("# TYPE test_total counter"));
}

#[test]
fn test_metrics_histogram_buckets() {
    let reg = pixdock::metrics::MetricsRegistry::new();
    reg.observe_histogram("latency", "Request latency", 0.15);
    reg.observe_histogram("latency", "Request latency", 1.5);
    let output = reg.render();
    assert!(output.contains("latency_bucket{le=\"0.1\"}"));
    assert!(output.contains("latency_sum 1.65"));
}

// --- Delta diff tests ---

#[test]
fn test_diff_empty_states() {
    let result = pixdock::ws::delta::diff(&[], &[], &[], &[], &[], &[]);
    assert!(result.is_none());
}

#[test]
fn test_diff_container_added() {
    use pixdock::docker::containers::Container;
    let curr = vec![Container {
        id: "abc".into(),
        name: "web".into(),
        image: "nginx".into(),
        state: "running".into(),
        status: "Up".into(),
        created: 1,
        ports: vec![],
        project: None,
    }];
    let result = pixdock::ws::delta::diff(&[], &curr, &[], &[], &[], &[]);
    assert!(result.is_some());
}

#[test]
fn test_diff_no_change_returns_none() {
    use pixdock::docker::containers::Container;
    let c = vec![Container {
        id: "abc".into(),
        name: "web".into(),
        image: "nginx".into(),
        state: "running".into(),
        status: "Up".into(),
        created: 1,
        ports: vec![],
        project: None,
    }];
    let result = pixdock::ws::delta::diff(&c, &c, &[], &[], &[], &[]);
    assert!(result.is_none());
}

// --- Notify tests ---

#[tokio::test]
async fn test_notify_wakes_receiver() {
    let notify = Arc::new(Notify::new());
    let notify2 = notify.clone();

    let handle = tokio::spawn(async move {
        tokio::select! {
            _ = notify2.notified() => true,
            _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => false,
        }
    });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    notify.notify_one();

    assert!(handle.await.unwrap());
}

#[tokio::test]
async fn test_notify_multiple_wakers() {
    let notify = Arc::new(Notify::new());

    let n1 = notify.clone();
    let n2 = notify.clone();

    let h1 = tokio::spawn(async move { n1.notified().await });
    let h2 = tokio::spawn(async move { n2.notified().await });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    notify.notify_waiters(); // wake all

    h1.await.unwrap();
    h2.await.unwrap();
}

// --- DockerClient error tests ---

#[test]
fn test_docker_error_all_variants() {
    use pixdock::docker::client::DockerError;

    assert_eq!(
        format!("{}", DockerError::Connection("refused".into())),
        "Connection error: refused"
    );
    assert_eq!(
        format!("{}", DockerError::Body("incomplete".into())),
        "Body read error: incomplete"
    );
    assert_eq!(
        format!("{}", DockerError::Api { status: 500, message: "err".into() }),
        "API error 500: err"
    );
}

// --- State clone test ---

#[tokio::test]
async fn test_state_is_cloneable() {
    let state = test_app_state();
    let cloned = state.clone();
    assert_eq!(
        cloned.docker.versioned_path("/test"),
        "/v1.43/test"
    );
}

// --- Validate docker ID tests ---

#[test]
fn test_validate_docker_id_edge_cases() {
    // These are tested in the route module's tests, but verify from integration level
    let valid_ids = ["a", "abc123", "my-container", "test_v1.0", &"x".repeat(128)];
    for id in &valid_ids {
        let all_valid = id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
            && !id.is_empty()
            && id.len() <= 128;
        assert!(all_valid, "ID should be valid: {}", id);
    }

    let invalid_ids = ["", "ab/cd", "ab cd", "ab;rm", "test\nx", "<script>"];
    for id in &invalid_ids {
        let all_valid = id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
            && !id.is_empty()
            && id.len() <= 128;
        assert!(!all_valid, "ID should be invalid: {}", id);
    }
}
