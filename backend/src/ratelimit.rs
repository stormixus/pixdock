use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use axum::response::{IntoResponse, Response};
use std::collections::HashMap;
use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};
use tower::{Layer, Service};

#[derive(Clone)]
pub struct IpRateLimitLayer {
    state: Arc<Mutex<HashMap<String, Counter>>>,
    max_requests: u32,
    window: Duration,
}

#[derive(Clone, Copy)]
struct Counter {
    window_started_at: Instant,
    count: u32,
}

impl IpRateLimitLayer {
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            state: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window,
        }
    }

    pub fn per_minute(max_requests: u32) -> Self {
        Self::new(max_requests, Duration::from_secs(60))
    }
}

#[derive(Clone)]
pub struct IpRateLimit<S> {
    inner: S,
    state: Arc<Mutex<HashMap<String, Counter>>>,
    max_requests: u32,
    window: Duration,
}

impl<S> Layer<S> for IpRateLimitLayer {
    type Service = IpRateLimit<S>;

    fn layer(&self, inner: S) -> Self::Service {
        IpRateLimit {
            inner,
            state: self.state.clone(),
            max_requests: self.max_requests,
            window: self.window,
        }
    }
}

impl<S, B> Service<Request<B>> for IpRateLimit<S>
where
    S: Service<Request<B>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
    S::Error: Send + 'static,
    B: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<B>) -> Self::Future {
        let client = extract_client_id(&request);
        if self.is_limited(&client) {
            let response = (
                StatusCode::TOO_MANY_REQUESTS,
                "Rate limit exceeded (30 requests/minute)",
            )
                .into_response();
            return Box::pin(async move { Ok(response) });
        }

        let mut inner = self.inner.clone();
        Box::pin(async move { inner.call(request).await })
    }
}

impl<S> IpRateLimit<S> {
    fn is_limited(&self, client: &str) -> bool {
        let now = Instant::now();
        let mut state = match self.state.lock() {
            Ok(lock) => lock,
            Err(poisoned) => poisoned.into_inner(),
        };

        state.retain(|_, counter| now.duration_since(counter.window_started_at) <= self.window);

        let counter = state.entry(client.to_string()).or_insert(Counter {
            window_started_at: now,
            count: 0,
        });

        if now.duration_since(counter.window_started_at) > self.window {
            counter.window_started_at = now;
            counter.count = 0;
        }

        if counter.count >= self.max_requests {
            true
        } else {
            counter.count += 1;
            false
        }
    }
}

fn extract_client_id<B>(request: &Request<B>) -> String {
    if let Some(value) = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|raw| raw.split(',').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return value.to_string();
    }

    if let Some(connect_info) = request.extensions().get::<ConnectInfo<SocketAddr>>() {
        return connect_info.0.ip().to_string();
    }

    "unknown".to_string()
}
