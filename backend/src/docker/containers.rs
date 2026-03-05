use super::client::DockerClient;
use hyper::body::Incoming;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Container {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub created: i64,
    pub ports: Vec<ContainerPort>,
    pub project: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerPort {
    pub private_port: u16,
    pub public_port: Option<u16>,
    pub port_type: String,
}

impl DockerClient {
    /// Detect if Docker is in Swarm mode
    pub async fn is_swarm_mode(&self) -> bool {
        let info: Result<serde_json::Value, _> = self.get("/info").await;
        match info {
            Ok(v) => v["Swarm"]["LocalNodeState"].as_str() == Some("active"),
            Err(_) => false,
        }
    }

    /// List all containers
    pub async fn list_containers(&self) -> Result<Vec<Container>, super::client::DockerError> {
        let raw: Vec<serde_json::Value> = self.get("/containers/json?all=true").await?;

        let containers = raw
            .into_iter()
            .map(|c| {
                let name = c["Names"]
                    .as_array()
                    .and_then(|arr| arr.first())
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .trim_start_matches('/')
                    .to_string();

                let ports = c["Ports"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|p| ContainerPort {
                                private_port: p["PrivatePort"].as_u64().unwrap_or(0) as u16,
                                public_port: p["PublicPort"].as_u64().map(|v| v as u16),
                                port_type: p["Type"].as_str().unwrap_or("tcp").to_string(),
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                let project = c["Labels"]["com.docker.compose.project"]
                    .as_str()
                    .map(|s| s.to_string());

                Container {
                    id: c["Id"].as_str().unwrap_or("").chars().take(12).collect(),
                    name,
                    image: c["Image"].as_str().unwrap_or("").to_string(),
                    state: c["State"].as_str().unwrap_or("unknown").to_string(),
                    status: c["Status"].as_str().unwrap_or("").to_string(),
                    created: c["Created"].as_i64().unwrap_or(0),
                    ports,
                    project,
                }
            })
            .collect();

        Ok(containers)
    }

    /// Start a container
    pub async fn start_container(&self, id: &str) -> Result<(), super::client::DockerError> {
        let path = format!("/containers/{}/start", id);
        self.post_empty(&path).await
    }

    /// Stop a container
    pub async fn stop_container(&self, id: &str) -> Result<(), super::client::DockerError> {
        let path = format!("/containers/{}/stop", id);
        self.post_empty(&path).await
    }

    /// Restart a container
    pub async fn restart_container(&self, id: &str) -> Result<(), super::client::DockerError> {
        let path = format!("/containers/{}/restart", id);
        self.post_empty(&path).await
    }

    /// Get container logs (recent lines)
    pub async fn get_logs(
        &self,
        id: &str,
        tail: u32,
        timestamps: bool,
    ) -> Result<Vec<String>, super::client::DockerError> {
        let path = format!(
            "/containers/{}/logs?stdout=true&stderr=true&tail={}&timestamps={}",
            id, tail, timestamps
        );
        let raw = self.get_raw(&path).await?;

        // Docker multiplexed stream: each frame has 8-byte header
        // [stream_type(1), 0, 0, 0, size(4 bytes big-endian)]
        let mut lines = Vec::new();
        let mut pos = 0;

        while pos + 8 <= raw.len() {
            // Skip stream type byte and 3 padding bytes
            let size = u32::from_be_bytes([raw[pos + 4], raw[pos + 5], raw[pos + 6], raw[pos + 7]])
                as usize;
            pos += 8;

            if pos + size > raw.len() {
                break;
            }

            let line = String::from_utf8_lossy(&raw[pos..pos + size])
                .trim_end()
                .to_string();
            if !line.is_empty() {
                lines.push(line);
            }
            pos += size;
        }

        Ok(lines)
    }

    /// Inspect a container via Docker API.
    pub async fn inspect_container(
        &self,
        id: &str,
    ) -> Result<serde_json::Value, super::client::DockerError> {
        let path = format!("/containers/{}/json", id);
        self.get(&path).await
    }

    /// Stream container logs using Docker's follow API.
    pub async fn stream_logs(
        &self,
        id: &str,
        tail: u32,
        timestamps: bool,
    ) -> Result<Incoming, super::client::DockerError> {
        let path = format!(
            "/containers/{}/logs?stdout=true&stderr=true&follow=true&tail={}&timestamps={}",
            id, tail, timestamps
        );
        self.get_stream(&path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_multiplexed_logs(raw: &[u8]) -> Vec<String> {
        let mut lines = Vec::new();
        let mut pos = 0;
        while pos + 8 <= raw.len() {
            let size = u32::from_be_bytes([raw[pos + 4], raw[pos + 5], raw[pos + 6], raw[pos + 7]])
                as usize;
            pos += 8;
            if pos + size > raw.len() {
                break;
            }
            let line = String::from_utf8_lossy(&raw[pos..pos + size])
                .trim_end()
                .to_string();
            if !line.is_empty() {
                lines.push(line);
            }
            pos += size;
        }
        lines
    }

    #[test]
    fn test_container_roundtrip() {
        let container = Container {
            id: "abc123def456".to_string(),
            name: "test-container".to_string(),
            image: "nginx:latest".to_string(),
            state: "running".to_string(),
            status: "Up 2 hours".to_string(),
            created: 1709654400,
            ports: vec![ContainerPort {
                private_port: 80,
                public_port: Some(8080),
                port_type: "tcp".to_string(),
            }],
            project: Some("myapp".to_string()),
        };
        let json = serde_json::to_string(&container).unwrap();
        let parsed: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "abc123def456");
        assert_eq!(parsed.name, "test-container");
        assert_eq!(parsed.state, "running");
        assert_eq!(parsed.ports.len(), 1);
        assert_eq!(parsed.ports[0].public_port, Some(8080));
        assert_eq!(parsed.project, Some("myapp".to_string()));
    }

    #[test]
    fn test_container_without_project() {
        let container = Container {
            id: "abc".to_string(),
            name: "standalone".to_string(),
            image: "redis".to_string(),
            state: "exited".to_string(),
            status: "Exited (0)".to_string(),
            created: 0,
            ports: vec![],
            project: None,
        };
        let json = serde_json::to_string(&container).unwrap();
        let parsed: Container = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.project, None);
    }

    #[test]
    fn test_parse_logs_valid_frames() {
        // stdout frame (type=1): "hello\n"
        let mut raw = vec![1, 0, 0, 0, 0, 0, 0, 6];
        raw.extend_from_slice(b"hello\n");
        // stderr frame (type=2): "error\n"
        raw.extend_from_slice(&[2, 0, 0, 0, 0, 0, 0, 6]);
        raw.extend_from_slice(b"error\n");

        let lines = parse_multiplexed_logs(&raw);
        assert_eq!(lines, vec!["hello", "error"]);
    }

    #[test]
    fn test_parse_logs_empty_input() {
        let lines = parse_multiplexed_logs(&[]);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_parse_logs_truncated_header() {
        let raw = vec![1, 0, 0]; // incomplete header
        let lines = parse_multiplexed_logs(&raw);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_parse_logs_truncated_body() {
        let mut raw = vec![1, 0, 0, 0, 0, 0, 0, 100]; // claims 100 bytes
        raw.extend_from_slice(b"short"); // only 5 bytes
        let lines = parse_multiplexed_logs(&raw);
        assert!(lines.is_empty());
    }
}
