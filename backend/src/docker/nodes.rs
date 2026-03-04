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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swarm_node_roundtrip() {
        let node = SwarmNode {
            id: "node123".to_string(),
            hostname: "docker-node-1".to_string(),
            role: "manager".to_string(),
            status: "ready".to_string(),
            availability: "active".to_string(),
            engine_version: "24.0.7".to_string(),
            ip: "192.168.1.10".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            cpus: 4,
            memory_bytes: 8_589_934_592,
        };
        let json = serde_json::to_string(&node).unwrap();
        let parsed: SwarmNode = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.hostname, "docker-node-1");
        assert_eq!(parsed.role, "manager");
        assert_eq!(parsed.cpus, 4);
        assert_eq!(parsed.memory_bytes, 8_589_934_592);
    }
}
