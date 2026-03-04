use super::client::DockerClient;
use serde::{Deserialize, Serialize};

/// Simplified service info for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmService {
    pub id: String,
    pub name: String,
    pub image: String,
    pub replicas_running: u64,
    pub replicas_desired: u64,
    pub ports: Vec<ServicePort>,
    pub updated_at: String,
    pub stack: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePort {
    pub published: u16,
    pub target: u16,
    pub protocol: String,
}

/// Task info for service detail view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmTask {
    pub id: String,
    pub service_id: String,
    pub node_id: String,
    pub status: String,
    pub desired_state: String,
    pub slot: u64,
    pub error: Option<String>,
    pub timestamp: String,
}

impl DockerClient {
    pub async fn list_services(&self) -> Result<Vec<SwarmService>, super::client::DockerError> {
        let raw: Vec<serde_json::Value> = self.get("/services").await?;
        // Only fetch running tasks to reduce payload
        let filter = urlencoding::encode(r#"{"desired-state":["running"]}"#);
        let tasks_path = format!("/tasks?filters={}", filter);
        let tasks: Vec<serde_json::Value> = self.get(&tasks_path).await?;

        let services = raw
            .into_iter()
            .map(|s| {
                let spec = &s["Spec"];
                let task_template = &spec["TaskTemplate"];
                let container_spec = &task_template["ContainerSpec"];
                let service_id = s["ID"].as_str().unwrap_or("").to_string();

                // Count running tasks for this service
                let replicas_running = tasks
                    .iter()
                    .filter(|t| {
                        t["ServiceID"].as_str() == Some(&service_id)
                            && t["Status"]["State"].as_str() == Some("running")
                    })
                    .count() as u64;

                // Desired replicas
                let replicas_desired = spec["Mode"]["Replicated"]["Replicas"]
                    .as_u64()
                    .unwrap_or(1);

                // Ports
                let ports = s["Endpoint"]["Ports"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|p| ServicePort {
                                published: p["PublishedPort"].as_u64().unwrap_or(0) as u16,
                                target: p["TargetPort"].as_u64().unwrap_or(0) as u16,
                                protocol: p["Protocol"]
                                    .as_str()
                                    .unwrap_or("tcp")
                                    .to_string(),
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                // Stack label
                let stack = spec["Labels"]["com.docker.stack.namespace"]
                    .as_str()
                    .map(|s| s.to_string());

                SwarmService {
                    id: service_id,
                    name: spec["Name"].as_str().unwrap_or("").to_string(),
                    image: container_spec["Image"]
                        .as_str()
                        .unwrap_or("")
                        .split('@')
                        .next()
                        .unwrap_or("")
                        .to_string(),
                    replicas_running,
                    replicas_desired,
                    ports,
                    updated_at: s["UpdatedAt"].as_str().unwrap_or("").to_string(),
                    stack,
                }
            })
            .collect();

        Ok(services)
    }

    /// List tasks for a specific service
    pub async fn list_tasks(&self, service_id: &str) -> Result<Vec<SwarmTask>, super::client::DockerError> {
        let filter_json = format!(r#"{{"service":["{}"]}}"#, service_id);
        let filter = urlencoding::encode(&filter_json);
        let path = format!("/tasks?filters={}", filter);
        let raw: Vec<serde_json::Value> = self.get(&path).await?;

        let tasks = raw
            .into_iter()
            .map(|t| {
                let status = &t["Status"];
                SwarmTask {
                    id: t["ID"].as_str().unwrap_or("").chars().take(12).collect(),
                    service_id: t["ServiceID"].as_str().unwrap_or("").to_string(),
                    node_id: t["NodeID"].as_str().unwrap_or("").to_string(),
                    status: status["State"].as_str().unwrap_or("unknown").to_string(),
                    desired_state: t["DesiredState"].as_str().unwrap_or("").to_string(),
                    slot: t["Slot"].as_u64().unwrap_or(0),
                    error: status["Err"].as_str().map(|s| s.to_string()),
                    timestamp: status["Timestamp"].as_str().unwrap_or("").to_string(),
                }
            })
            .collect();

        Ok(tasks)
    }

    /// Scale a service to the given number of replicas
    pub async fn scale_service(&self, service_id: &str, replicas: u64) -> Result<(), super::client::DockerError> {
        // First, get the current service spec (required for update)
        let svc: serde_json::Value = self.get(&format!("/services/{}", service_id)).await?;
        let version = svc["Version"]["Index"].as_u64().unwrap_or(0);

        let mut spec = svc["Spec"].clone();
        spec["Mode"]["Replicated"]["Replicas"] = serde_json::json!(replicas);

        let path = format!("/services/{}/update?version={}", service_id, version);
        let body = serde_json::to_string(&spec).unwrap();

        let _: serde_json::Value = self.post(&path, body).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swarm_service_roundtrip() {
        let svc = SwarmService {
            id: "svc123".to_string(),
            name: "web".to_string(),
            image: "nginx:latest".to_string(),
            replicas_running: 3,
            replicas_desired: 3,
            ports: vec![ServicePort {
                published: 80,
                target: 80,
                protocol: "tcp".to_string(),
            }],
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            stack: Some("mystack".to_string()),
        };
        let json = serde_json::to_string(&svc).unwrap();
        let parsed: SwarmService = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "web");
        assert_eq!(parsed.replicas_running, 3);
        assert_eq!(parsed.stack, Some("mystack".to_string()));
    }

    #[test]
    fn test_swarm_task_roundtrip() {
        let task = SwarmTask {
            id: "task123".to_string(),
            service_id: "svc123".to_string(),
            node_id: "node1".to_string(),
            status: "running".to_string(),
            desired_state: "running".to_string(),
            slot: 1,
            error: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&task).unwrap();
        let parsed: SwarmTask = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "running");
        assert!(parsed.error.is_none());
    }

    #[test]
    fn test_swarm_task_with_error() {
        let task = SwarmTask {
            id: "task456".to_string(),
            service_id: "svc123".to_string(),
            node_id: "node1".to_string(),
            status: "failed".to_string(),
            desired_state: "running".to_string(),
            slot: 2,
            error: Some("container exited with code 1".to_string()),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&task).unwrap();
        let parsed: SwarmTask = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.error, Some("container exited with code 1".to_string()));
    }
}
