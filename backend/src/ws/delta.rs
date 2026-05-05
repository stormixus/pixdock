use serde::Serialize;

use crate::docker::containers::Container;
use crate::docker::nodes::SwarmNode;
use crate::docker::services::SwarmService;

/// A delta patch carries only the entity groups that changed since the last broadcast.
/// This is NOT JSON Patch (RFC 6902) — it's a per-group partial payload.
#[derive(Debug, Clone, Serialize)]
pub struct DeltaPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub containers: Option<Vec<Container>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub services: Option<Vec<SwarmService>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nodes: Option<Vec<SwarmNode>>,
}

impl DeltaPatch {
    /// Returns true if no groups have changes.
    pub fn is_empty(&self) -> bool {
        self.containers.is_none() && self.services.is_none() && self.nodes.is_none()
    }
}

/// Compute a diff between two snapshots.
/// Returns `None` if nothing changed — the caller should skip this broadcast tick.
pub fn diff(
    prev_containers: &[Container],
    curr_containers: &[Container],
    prev_services: &[SwarmService],
    curr_services: &[SwarmService],
    prev_nodes: &[SwarmNode],
    curr_nodes: &[SwarmNode],
) -> Option<DeltaPatch> {
    let mut patch = DeltaPatch {
        containers: None,
        services: None,
        nodes: None,
    };

    let containers_json_prev = serde_json::to_value(prev_containers).ok();
    let containers_json_curr = serde_json::to_value(curr_containers).ok();
    if containers_json_prev != containers_json_curr {
        patch.containers = Some(curr_containers.to_vec());
    }

    let services_json_prev = serde_json::to_value(prev_services).ok();
    let services_json_curr = serde_json::to_value(curr_services).ok();
    if services_json_prev != services_json_curr {
        patch.services = Some(curr_services.to_vec());
    }

    let nodes_json_prev = serde_json::to_value(prev_nodes).ok();
    let nodes_json_curr = serde_json::to_value(curr_nodes).ok();
    if nodes_json_prev != nodes_json_curr {
        patch.nodes = Some(curr_nodes.to_vec());
    }

    if patch.is_empty() {
        None
    } else {
        Some(patch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_container(id: &str, state: &str) -> Container {
        Container {
            id: id.to_string(),
            name: format!("container_{}", id),
            image: "nginx:latest".to_string(),
            state: state.to_string(),
            status: "Up 2 hours".to_string(),
            created: 1000,
            ports: vec![],
            project: None,
        }
    }

    fn make_service(id: &str) -> SwarmService {
        SwarmService {
            id: id.to_string(),
            name: format!("svc_{}", id),
            image: "nginx:latest".to_string(),
            replicas_running: 1,
            replicas_desired: 1,
            ports: vec![],
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            stack: None,
        }
    }

    fn make_node(id: &str) -> SwarmNode {
        SwarmNode {
            id: id.to_string(),
            hostname: format!("node_{}", id),
            role: "worker".to_string(),
            status: "ready".to_string(),
            availability: "active".to_string(),
            engine_version: "24.0.0".to_string(),
            ip: "10.0.0.1".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            cpus: 4,
            memory_bytes: 8_589_934_592,
        }
    }

    #[test]
    fn test_diff_empty_state() {
        let result = diff(&[], &[], &[], &[], &[], &[]);
        assert!(result.is_none());
    }

    #[test]
    fn test_diff_container_added() {
        let curr = vec![make_container("abc", "running")];
        let result = diff(&[], &curr, &[], &[], &[], &[]);
        let patch = result.unwrap();
        assert!(patch.containers.is_some());
        assert_eq!(patch.containers.unwrap().len(), 1);
        assert!(patch.services.is_none());
        assert!(patch.nodes.is_none());
    }

    #[test]
    fn test_diff_container_state_changed() {
        let prev = vec![make_container("abc", "running")];
        let curr = vec![make_container("abc", "exited")];
        let result = diff(&prev, &curr, &[], &[], &[], &[]);
        let patch = result.unwrap();
        assert!(patch.containers.is_some());
    }

    #[test]
    fn test_diff_no_change() {
        let c = vec![make_container("abc", "running")];
        let result = diff(&c, &c, &[], &[], &[], &[]);
        assert!(result.is_none());
    }

    #[test]
    fn test_diff_multiple_groups() {
        let curr_containers = vec![make_container("abc", "running")];
        let curr_services = vec![make_service("s1")];
        let curr_nodes = vec![make_node("n1")];

        let result = diff(
            &[],
            &curr_containers,
            &[],
            &curr_services,
            &[],
            &curr_nodes,
        );

        let patch = result.unwrap();
        assert!(patch.containers.is_some());
        assert!(patch.services.is_some());
        assert!(patch.nodes.is_some());
    }

    #[test]
    fn test_is_empty() {
        let empty = DeltaPatch {
            containers: None,
            services: None,
            nodes: None,
        };
        assert!(empty.is_empty());

        let non_empty = DeltaPatch {
            containers: Some(vec![]),
            services: None,
            nodes: None,
        };
        assert!(!non_empty.is_empty());
    }
}
