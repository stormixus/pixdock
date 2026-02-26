use hyper::Request;
use hyper_util::client::legacy::Client;
use hyperlocal::{UnixClientExt, UnixConnector, Uri};
use http_body_util::BodyExt;
use serde::de::DeserializeOwned;

const DOCKER_SOCKET: &str = "/var/run/docker.sock";
const API_VERSION: &str = "/v1.43";

#[derive(Clone)]
pub struct DockerClient {
    client: Client<UnixConnector, String>,
}

impl DockerClient {
    pub fn new() -> Self {
        let client = Client::unix();
        Self { client }
    }

    /// Build a versioned Docker API path
    fn versioned_path(path: &str) -> String {
        format!("{}{}", API_VERSION, path)
    }

    /// GET request to Docker API
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, DockerError> {
        let full_path = Self::versioned_path(path);
        let uri = Uri::new(DOCKER_SOCKET, &full_path);

        let response = self
            .client
            .get(uri.into())
            .await
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| DockerError::Body(e.to_string()))?
            .to_bytes();

        if !status.is_success() {
            let msg = String::from_utf8_lossy(&body_bytes).to_string();
            return Err(DockerError::Api { status: status.as_u16(), message: msg });
        }

        serde_json::from_slice(&body_bytes)
            .map_err(|e| DockerError::Parse(e.to_string()))
    }

    /// POST request with empty body (for container actions)
    pub async fn post_empty(&self, path: &str) -> Result<(), DockerError> {
        let full_path = Self::versioned_path(path);
        let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();

        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .body(String::new())
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let response = self
            .client
            .request(req)
            .await
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let status = response.status();
        if !status.is_success() && status.as_u16() != 304 {
            let body_bytes = response
                .into_body()
                .collect()
                .await
                .map_err(|e| DockerError::Body(e.to_string()))?
                .to_bytes();
            let msg = String::from_utf8_lossy(&body_bytes).to_string();
            return Err(DockerError::Api { status: status.as_u16(), message: msg });
        }

        Ok(())
    }

    /// POST request to Docker API with JSON body
    pub async fn post<T: DeserializeOwned>(&self, path: &str, body: String) -> Result<T, DockerError> {
        let full_path = Self::versioned_path(path);
        let uri: hyper::Uri = Uri::new(DOCKER_SOCKET, &full_path).into();

        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("Content-Type", "application/json")
            .body(body)
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let response = self
            .client
            .request(req)
            .await
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| DockerError::Body(e.to_string()))?
            .to_bytes();

        if !status.is_success() {
            let msg = String::from_utf8_lossy(&body_bytes).to_string();
            return Err(DockerError::Api { status: status.as_u16(), message: msg });
        }

        serde_json::from_slice(&body_bytes)
            .map_err(|e| DockerError::Parse(e.to_string()))
    }
    /// GET request returning raw bytes (for logs, etc.)
    pub async fn get_raw(&self, path: &str) -> Result<Vec<u8>, DockerError> {
        let full_path = Self::versioned_path(path);
        let uri = Uri::new(DOCKER_SOCKET, &full_path);

        let response = self
            .client
            .get(uri.into())
            .await
            .map_err(|e| DockerError::Connection(e.to_string()))?;

        let status = response.status();
        let body_bytes = response
            .into_body()
            .collect()
            .await
            .map_err(|e| DockerError::Body(e.to_string()))?
            .to_bytes();

        if !status.is_success() {
            let msg = String::from_utf8_lossy(&body_bytes).to_string();
            return Err(DockerError::Api { status: status.as_u16(), message: msg });
        }

        Ok(body_bytes.to_vec())
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
