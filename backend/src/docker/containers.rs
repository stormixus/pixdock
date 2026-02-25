use super::client::DockerClient;
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
                    id: c["Id"]
                        .as_str()
                        .unwrap_or("")
                        .chars()
                        .take(12)
                        .collect(),
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
}
