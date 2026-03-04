use super::client::DockerClient;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerImage {
    pub id: String,
    pub repo_tags: Vec<String>,
    pub size: u64,
    pub created: i64,
    pub containers: i64,
}

impl DockerClient {
    pub async fn list_images(&self) -> Result<Vec<DockerImage>, super::client::DockerError> {
        let raw: Vec<serde_json::Value> = self.get("/images/json").await?;

        let images = raw
            .into_iter()
            .map(|img| {
                let repo_tags = img["RepoTags"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|t| t.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                DockerImage {
                    id: img["Id"]
                        .as_str()
                        .unwrap_or("")
                        .trim_start_matches("sha256:")
                        .chars()
                        .take(12)
                        .collect(),
                    repo_tags,
                    size: img["Size"].as_u64().unwrap_or(0),
                    created: img["Created"].as_i64().unwrap_or(0),
                    containers: img["Containers"].as_i64().unwrap_or(-1),
                }
            })
            .collect();

        Ok(images)
    }

    pub async fn delete_image(&self, id: &str) -> Result<(), super::client::DockerError> {
        let path = format!("/images/{}", id);
        self.delete(&path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_docker_image_roundtrip() {
        let img = DockerImage {
            id: "abc123def456".to_string(),
            repo_tags: vec!["nginx:latest".to_string(), "nginx:1.25".to_string()],
            size: 187_000_000,
            created: 1709654400,
            containers: 2,
        };
        let json = serde_json::to_string(&img).unwrap();
        let parsed: DockerImage = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "abc123def456");
        assert_eq!(parsed.repo_tags.len(), 2);
        assert_eq!(parsed.size, 187_000_000);
    }
}
