use http_body_util::BodyExt;
use hyper::body::Incoming;
use hyper::Request;
use hyper_util::client::legacy::Client;
use hyperlocal::{UnixClientExt, UnixConnector, Uri};
use serde::de::DeserializeOwned;
use std::sync::{Arc, RwLock};
use std::time::Duration;

const DOCKER_SOCKET: &str = "/var/run/docker.sock";
const DEFAULT_API_VERSION: &str = "v1.43";
const PREFERRED_API_VERSION: &str = "v1.44";
const RETRY_BASE_MS: u64 = 100;
const MAX_RETRIES: u32 = 2;

#[derive(Clone)]
pub struct DockerClient {
    client: Arc<RwLock<Client<UnixConnector, String>>>,
    api_version: String,
}

impl DockerClient {
    pub fn new(api_version: String) -> Self {
        let client = Client::unix();
        Self {
            client: Arc::new(RwLock::new(client)),
            api_version,
        }
    }

    /// Clone the inner hyper Client (which is cheap — uses Arc internally).
    fn clone_client(&self) -> Result<Client<UnixConnector, String>, DockerError> {
        let guard = self
            .client
            .read()
            .map_err(|e| DockerError::Connection(format!("RwLock poisoned: {}", e)))?;
        Ok(guard.clone())
    }

    /// Detect the highest supported Docker API version.
    /// Queries GET /version and selects v1.44 if available, otherwise falls back to v1.43.
    pub async fn detect_api_version() -> String {
        let client: Client<UnixConnector, String> = Client::unix();
        let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, "/version").into();

        let response = match client.get(uri).await {
            Ok(resp) => resp,
            Err(e) => {
                tracing::warn!(
                    "Failed to query Docker /version: {}, falling back to /{}",
                    e,
                    DEFAULT_API_VERSION
                );
                return format!("/{}", DEFAULT_API_VERSION);
            }
        };

        let status = response.status();
        let body_bytes = match response.into_body().collect().await {
            Ok(b) => b.to_bytes(),
            Err(e) => {
                tracing::warn!(
                    "Failed to read Docker /version body: {}, falling back to /{}",
                    e,
                    DEFAULT_API_VERSION
                );
                return format!("/{}", DEFAULT_API_VERSION);
            }
        };

        if !status.is_success() {
            tracing::warn!(
                "Docker /version returned {}, falling back to /{}",
                status.as_u16(),
                DEFAULT_API_VERSION
            );
            return format!("/{}", DEFAULT_API_VERSION);
        }

        let version_json: Result<serde_json::Value, _> = serde_json::from_slice(&body_bytes);
        match version_json {
            Ok(v) => {
                let api_ver = v["ApiVersion"].as_str().unwrap_or("");
                if api_ver.is_empty() {
                    tracing::warn!(
                        "Docker /version missing ApiVersion, falling back to /{}",
                        DEFAULT_API_VERSION
                    );
                    return format!("/{}", DEFAULT_API_VERSION);
                }

                let major_minor: Vec<&str> = api_ver.split('.').collect();
                if major_minor.len() >= 2 {
                    let major: u32 = major_minor[0].parse().unwrap_or(0);
                    let minor: u32 = major_minor[1].parse().unwrap_or(0);
                    let pmaj: u32 = PREFERRED_API_VERSION
                        .strip_prefix('v')
                        .unwrap_or("1")
                        .split('.')
                        .next()
                        .unwrap_or("1")
                        .parse()
                        .unwrap_or(1);
                    let pmin: u32 = PREFERRED_API_VERSION
                        .split('.')
                        .nth(1)
                        .unwrap_or("44")
                        .parse()
                        .unwrap_or(44);

                    if major > pmaj || (major == pmaj && minor >= pmin) {
                        tracing::info!(
                            "Docker API version: v{}.{} (using {})",
                            major,
                            minor,
                            PREFERRED_API_VERSION
                        );
                        return format!("/{}", PREFERRED_API_VERSION);
                    }
                }

                tracing::info!(
                    "Docker API version: {} (using /{})",
                    api_ver,
                    DEFAULT_API_VERSION
                );
                format!("/{}", DEFAULT_API_VERSION)
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to parse Docker /version JSON: {}, falling back to /{}",
                    e,
                    DEFAULT_API_VERSION
                );
                format!("/{}", DEFAULT_API_VERSION)
            }
        }
    }

    pub fn versioned_path(&self, path: &str) -> String {
        format!("{}{}", self.api_version, path)
    }

    /// GET request to Docker API
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();
            let client = self.clone_client()?;
            match client.get(uri).await {
                Ok(response) => {
                    return Self::parse_json_response(response).await;
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// POST request with empty body (for container actions)
    pub async fn post_empty(&self, path: &str) -> Result<(), DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();

            let req = Request::builder()
                .method("POST")
                .uri(uri)
                .body(String::new())
                .map_err(|e| DockerError::Connection(e.to_string()))?;

            let client = self.clone_client()?;
            match client.request(req).await {
                Ok(response) => {
                    let status = response.status();
                    if !status.is_success() && status.as_u16() != 304 {
                        let body_bytes = response
                            .into_body()
                            .collect()
                            .await
                            .map_err(|e| DockerError::Body(e.to_string()))?
                            .to_bytes();
                        let msg = String::from_utf8_lossy(&body_bytes).to_string();
                        return Err(DockerError::Api {
                            status: status.as_u16(),
                            message: msg,
                        });
                    }
                    return Ok(());
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// POST request to Docker API with JSON body
    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: String,
    ) -> Result<T, DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();

            let req = Request::builder()
                .method("POST")
                .uri(uri)
                .header("Content-Type", "application/json")
                .body(body.clone())
                .map_err(|e| DockerError::Connection(e.to_string()))?;

            let client = self.clone_client()?;
            match client.request(req).await {
                Ok(response) => {
                    return Self::parse_json_response(response).await;
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// DELETE request to Docker API
    pub async fn delete(&self, path: &str) -> Result<(), DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();

            let req = Request::builder()
                .method("DELETE")
                .uri(uri)
                .body(String::new())
                .map_err(|e| DockerError::Connection(e.to_string()))?;

            let client = self.clone_client()?;
            match client.request(req).await {
                Ok(response) => {
                    let status = response.status();
                    if !status.is_success() {
                        let body_bytes = response
                            .into_body()
                            .collect()
                            .await
                            .map_err(|e| DockerError::Body(e.to_string()))?
                            .to_bytes();
                        let msg = String::from_utf8_lossy(&body_bytes).to_string();
                        return Err(DockerError::Api {
                            status: status.as_u16(),
                            message: msg,
                        });
                    }
                    return Ok(());
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// GET request returning raw bytes (for logs, etc.)
    pub async fn get_raw(&self, path: &str) -> Result<Vec<u8>, DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri = Uri::new(DOCKER_SOCKET, &full_path);

            let client = self.clone_client()?;
            match client.get(uri.into()).await {
                Ok(response) => {
                    let status = response.status();
                    let body_bytes = response
                        .into_body()
                        .collect()
                        .await
                        .map_err(|e| DockerError::Body(e.to_string()))?
                        .to_bytes();

                    if !status.is_success() {
                        let msg = String::from_utf8_lossy(&body_bytes).to_string();
                        return Err(DockerError::Api {
                            status: status.as_u16(),
                            message: msg,
                        });
                    }

                    return Ok(body_bytes.to_vec());
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// GET request returning a streaming response body.
    pub async fn get_stream(&self, path: &str) -> Result<Incoming, DockerError> {
        let full_path = self.versioned_path(path);
        let mut attempt = 0;
        loop {
            let uri = Uri::new(DOCKER_SOCKET, &full_path);

            let client = self.clone_client()?;
            match client.get(uri.into()).await {
                Ok(response) => {
                    let status = response.status();
                    if !status.is_success() {
                        let body_bytes = response
                            .into_body()
                            .collect()
                            .await
                            .map_err(|e| DockerError::Body(e.to_string()))?
                            .to_bytes();
                        let msg = String::from_utf8_lossy(&body_bytes).to_string();
                        return Err(DockerError::Api {
                            status: status.as_u16(),
                            message: msg,
                        });
                    }

                    return Ok(response.into_body());
                }
                Err(e) => {
                    if attempt < MAX_RETRIES {
                        self.retry_swap_client();
                        let backoff = RETRY_BASE_MS * 4u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(backoff)).await;
                        attempt += 1;
                    } else {
                        return Err(DockerError::Connection(e.to_string()));
                    }
                }
            }
        }
    }

    /// Parse a successful JSON response.
    async fn parse_json_response<T: DeserializeOwned>(
        response: hyper::Response<Incoming>,
    ) -> Result<T, DockerError> {
        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| DockerError::Body(e.to_string()))?
            .to_bytes();

        if !status.is_success() {
            let msg = String::from_utf8_lossy(&body_bytes).to_string();
            return Err(DockerError::Api {
                status: status.as_u16(),
                message: msg,
            });
        }

        serde_json::from_slice(&body_bytes).map_err(|e| DockerError::Parse(e.to_string()))
    }

    /// Swap the inner hyper Client for a fresh one after connection errors.
    /// This avoids stale pooled connections to the Unix socket.
    fn retry_swap_client(&self) {
        let new_client = Client::unix();
        match self.client.write() {
            Ok(mut guard) => *guard = new_client,
            Err(e) => tracing::error!("RwLock poisoned during client swap: {}", e),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DockerError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Body read error: {0}")]
    Body(String),
    #[error("API error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("Parse error: {0}")]
    Parse(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_docker_error_display_connection() {
        let err = DockerError::Connection("refused".to_string());
        assert_eq!(format!("{}", err), "Connection error: refused");
    }

    #[test]
    fn test_docker_error_display_api() {
        let err = DockerError::Api {
            status: 404,
            message: "not found".to_string(),
        };
        assert_eq!(format!("{}", err), "API error 404: not found");
    }

    #[test]
    fn test_docker_error_display_parse() {
        let err = DockerError::Parse("invalid json".to_string());
        assert_eq!(format!("{}", err), "Parse error: invalid json");
    }

    #[test]
    fn test_versioned_path() {
        let client = DockerClient::new("/v1.44".to_string());
        let path = client.versioned_path("/containers/json");
        assert_eq!(path, "/v1.44/containers/json");
    }

    #[test]
    fn test_versioned_path_fallback() {
        let client = DockerClient::new("/v1.43".to_string());
        let path = client.versioned_path("/containers/json");
        assert_eq!(path, "/v1.43/containers/json");
    }

    #[test]
    fn test_versioned_path_always_starts_with_slash() {
        // Regression: detect_api_version() fallback paths must include leading /
        let client = DockerClient::new("/v1.43".to_string());
        let path = client.versioned_path("/info");
        assert!(path.starts_with('/'), "versioned_path must start with /, got: {}", path);
        assert_eq!(path, "/v1.43/info");
    }
}
