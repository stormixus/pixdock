use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use subtle::ConstantTimeEq;

/// Bearer token authentication middleware.
/// Reads the expected token from `PIXDOCK_TOKEN` env var.
/// If the env var is not set, authentication is disabled (open access).
pub async fn auth_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    let expected_token = match std::env::var("PIXDOCK_TOKEN") {
        Ok(token) if !token.is_empty() => token,
        // No token configured = auth disabled
        _ => return Ok(next.run(request).await),
    };

    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            let token = &header[7..];
            if token.as_bytes().ct_eq(expected_token.as_bytes()).into() {
                Ok(next.run(request).await)
            } else {
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}
