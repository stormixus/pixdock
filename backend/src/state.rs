use std::sync::Arc;

use tokio::sync::{mpsc, Notify};

use crate::audit::AuditEvent;
use crate::cache::DockerCache;
use crate::docker::DockerClient;
use crate::ws::handler::Broadcaster;

#[derive(Clone)]
pub struct AppState {
    pub docker: Arc<DockerClient>,
    pub broadcaster: Arc<Broadcaster>,
    pub cache: Option<Arc<DockerCache>>,
    pub notify: Arc<Notify>,
    pub audit_tx: mpsc::Sender<AuditEvent>,
}
