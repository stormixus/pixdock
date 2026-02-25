use super::client::DockerClient;
use serde::{Deserialize, Serialize};

/// Simplified node info for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmNode {
    pub id: String,
    pub hostname: String,
    pub role: String,        // "manager" | "worker"
    pub status: String,      // "ready" | "down" | "disconnected"
    pub availability: String, // "active" | "pause" | "drain"
    pub engine_version: String,
    pub ip: String,
    pub os: String,
    pub arch: String,
    pub cpus: u64,
    pub memory_bytes: u64,
}

impl DockerClient {
    pub async fn list_nodes(&self) -> Result<Vec<SwarmNode>, super::client::DockerError> {
        let raw: Vec<serde_json::Value> = self.get("/nodes").await?;

        let nodes = raw
            .into_iter()
            .map(|n| {
                let spec = &n["Spec"];
                let desc = &n["Description"];
                let status = &n["Status"];
                let resources = &desc["Resources"];

                SwarmNode {
                    id: n["ID"].as_str().unwrap_or("").to_string(),
                    hostname: desc["Hostname"].as_str().unwrap_or("unknown").to_string(),
                    role: spec["Role"].as_str().unwrap_or("worker").to_string(),
                    status: status["State"].as_str().unwrap_or("unknown").to_string(),
                    availability: spec["Availability"].as_str().unwrap_or("active").to_string(),
                    engine_version: desc["Engine"]["EngineVersion"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    ip: status["Addr"].as_str().unwrap_or("").to_string(),
                    os: desc["Platform"]["OS"].as_str().unwrap_or("").to_string(),
                    arch: desc["Platform"]["Architecture"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    cpus: resources["NanoCPUs"].as_u64().unwrap_or(0) / 1_000_000_000,
                    memory_bytes: resources["MemoryBytes"].as_u64().unwrap_or(0),
                }
            })
            .collect();

        Ok(nodes)
    }
}
