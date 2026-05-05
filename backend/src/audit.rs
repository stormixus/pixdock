use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::PathBuf;
use tokio::sync::mpsc;

const AUDIT_CHANNEL_CAPACITY: usize = 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub action: String,
    pub resource_type: String,
    pub resource_id: String,
    pub token_hash: String,
    pub timestamp: String,
}

/// Compute a short token fingerprint hash.
pub fn hash_token(token: &str) -> String {
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Spawn an audit writer background task.
/// Returns the sender for route handlers to push events.
pub fn spawn_audit_writer() -> mpsc::Sender<AuditEvent> {
    let (tx, mut rx) = mpsc::channel::<AuditEvent>(AUDIT_CHANNEL_CAPACITY);

    let use_sqlite = std::env::var("PIXDOCK_AUDIT_SQLITE")
        .map(|v| v.trim().to_ascii_lowercase() == "true")
        .unwrap_or(false);

    tokio::spawn(async move {
        if use_sqlite {
            run_sqlite_writer(&mut rx).await;
        } else {
            run_file_writer(&mut rx).await;
        }
    });

    tx
}

async fn run_file_writer(rx: &mut mpsc::Receiver<AuditEvent>) {
    let log_dir = std::env::var("PIXDOCK_AUDIT_DIR").unwrap_or_else(|_| ".".to_string());
    let log_path = PathBuf::from(&log_dir).join("audit.log");

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .expect("Failed to open audit log file");

    while let Some(event) = rx.recv().await {
        let line = serde_json::to_string(&event).unwrap_or_default();
        let _ = writeln!(file, "{}", line);
        let _ = file.flush();

        // Rotate at ~10MB
        if let Ok(meta) = file.metadata() {
            if meta.len() > 10 * 1024 * 1024 {
                let rotated = log_path.with_extension("audit.log.1");
                let _ = std::fs::rename(&log_path, &rotated);
                file = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                    .expect("Failed to reopen audit log after rotation");
            }
        }
    }
}

async fn run_sqlite_writer(rx: &mut mpsc::Receiver<AuditEvent>) {
    // Optional SQLite mode — requires rusqlite dependency.
    // For now, fall back to file writer.
    tracing::warn!(
        "PIXDOCK_AUDIT_SQLITE=true but SQLite support requires rusqlite crate; \
         falling back to file audit log"
    );
    run_file_writer(rx).await;
}

/// Query recent audit events from the file log.
pub fn query_audit_log(limit: usize) -> Vec<AuditEvent> {
    let log_dir = std::env::var("PIXDOCK_AUDIT_DIR").unwrap_or_else(|_| ".".to_string());
    let log_path = PathBuf::from(&log_dir).join("audit.log");

    let content = match std::fs::read_to_string(&log_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut events: Vec<AuditEvent> = content
        .lines()
        .filter_map(|line| serde_json::from_str::<AuditEvent>(line).ok())
        .collect();

    events.reverse();
    events.truncate(limit);
    events.reverse();
    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_token_deterministic() {
        let h1 = hash_token("my-secret-token");
        let h2 = hash_token("my-secret-token");
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_token_different() {
        let h1 = hash_token("token-a");
        let h2 = hash_token("token-b");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_token_length() {
        let h = hash_token("test");
        assert_eq!(h.len(), 16);
    }

    #[test]
    fn test_audit_event_serialization() {
        let event = AuditEvent {
            action: "stop".to_string(),
            resource_type: "container".to_string(),
            resource_id: "abc123".to_string(),
            token_hash: "abcd1234abcd1234".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"action\":\"stop\""));
        assert!(json.contains("\"resource_id\":\"abc123\""));
    }
}
