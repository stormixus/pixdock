use std::sync::Arc;

use crate::docker::DockerClient;
use crate::ws::handler::Broadcaster;

#[derive(Clone)]
pub struct AppState {
    pub docker: Arc<DockerClient>,
    pub broadcaster: Arc<Broadcaster>,
}
