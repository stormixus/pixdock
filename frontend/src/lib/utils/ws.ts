export interface SwarmNode {
  id: string;
  hostname: string;
  role: string;
  status: string;
  availability: string;
  engine_version: string;
  ip: string;
  os: string;
  arch: string;
  cpus: number;
  memory_bytes: number;
}

export interface ServicePort {
  published: number;
  target: number;
  protocol: string;
}

export interface SwarmService {
  id: string;
  name: string;
  image: string;
  replicas_running: number;
  replicas_desired: number;
  ports: ServicePort[];
  updated_at: string;
  stack: string | null;
}

export interface SwarmTask {
  id: string;
  service_id: string;
  node_id: string;
  status: string;
  desired_state: string;
  slot: number;
  error: string | null;
  timestamp: string;
}

export interface ContainerPort {
  private_port: number;
  public_port: number | null;
  port_type: string;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: ContainerPort[];
  project: string | null;
  node?: string;
}

export type DockerMode = 'swarm' | 'standalone';

export interface DashboardState {
  mode: DockerMode;
  nodes: SwarmNode[];
  services: SwarmService[];
  containers: Container[];
  timestamp: string;
  error?: string;
}

/** Envelope for all WS messages (delta protocol). */
export interface WsEnvelope {
  type: 'full' | 'delta';
  rev: number;
  data?: DashboardState;
  containers?: Container[];
  services?: SwarmService[];
  nodes?: SwarmNode[];
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// Read token from meta tag or localStorage
export function getAuthToken(): string | null {
  return localStorage.getItem('pixdock_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('pixdock_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('pixdock_token');
}

// Exponential backoff constants
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;

/**
 * Apply a delta patch to an existing DashboardState.
 * Returns a new state object with new array references only for patched groups,
 * so Svelte derived stores detect changes correctly.
 */
function applyDelta(current: DashboardState, envelope: WsEnvelope): DashboardState {
  return {
    ...current,
    ...(envelope.containers !== undefined ? { containers: envelope.containers } : {}),
    ...(envelope.services !== undefined ? { services: envelope.services } : {}),
    ...(envelope.nodes !== undefined ? { nodes: envelope.nodes } : {}),
    timestamp: new Date().toISOString(),
  };
}

export function createWebSocket(
  onState: (state: DashboardState) => void,
  onStatus: (status: ConnectionStatus) => void,
  onAuthError?: () => void
) {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let reconnectAttempt = 0;
  let lastDashboardState: DashboardState | null = null;

  function connect() {
    onStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}/ws`;

    // Append auth token as query parameter
    const token = getAuthToken();
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }

    ws = new WebSocket(url);

    ws.onopen = () => {
      onStatus('connected');
      reconnectAttempt = 0;
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);

        // Detect envelope vs legacy format
        if (raw.type === 'full') {
          // Full snapshot — replace entire store
          if (raw.data) {
            lastDashboardState = raw.data;
            onState(raw.data);
          }
        } else if (raw.type === 'delta') {
          // Delta patch — apply to current state
          if (lastDashboardState) {
            const patched = applyDelta(lastDashboardState, raw);
            lastDashboardState = patched;
            onState(patched);
          } else {
            // No state yet (shouldn't happen in normal flow) — fall back to requesting full
            console.warn('Received delta without prior state, ignoring');
          }
        } else {
          // Legacy format (no type field) — treat as full replacement
          console.warn('WS message missing type field, treating as full state');
          lastDashboardState = raw;
          onState(raw);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1008 || event.code === 4001) {
        onStatus('disconnected');
        onAuthError?.();
        return;
      }
      onStatus('disconnected');
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt) + Math.random() * 1000,
        RECONNECT_MAX_MS
      );
      reconnectAttempt++;
      reconnectTimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
    lastDashboardState = null;
  }

  if (localStorage.getItem('pd_mock_mode') === 'true') {
    onStatus('connected');

    const showcaseNodes: SwarmNode[] = [
      { id: 'n1', hostname: 'manager-01', role: 'manager', status: 'ready', availability: 'active', engine_version: '24.0.7', ip: '192.168.1.10', os: 'linux', arch: 'amd64', cpus: 8, memory_bytes: 17179869184 },
      { id: 'n2', hostname: 'worker-01', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0.7', ip: '192.168.1.11', os: 'linux', arch: 'amd64', cpus: 4, memory_bytes: 8589934592 },
      { id: 'n3', hostname: 'worker-02', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0.7', ip: '192.168.1.12', os: 'linux', arch: 'amd64', cpus: 4, memory_bytes: 8589934592 },
    ];

    const showcaseServices: SwarmService[] = [
      { id: 's1', name: 'webstack_nginx', image: 'nginx:alpine', replicas_running: 2, replicas_desired: 2, ports: [{ published: 80, target: 80, protocol: 'tcp' }], updated_at: new Date().toISOString(), stack: 'webstack' },
      { id: 's2', name: 'webstack_app', image: 'node:20-alpine', replicas_running: 2, replicas_desired: 2, ports: [], updated_at: new Date().toISOString(), stack: 'webstack' },
      { id: 's3', name: 'monitoring_prometheus', image: 'prom/prometheus:latest', replicas_running: 1, replicas_desired: 1, ports: [{ published: 9090, target: 9090, protocol: 'tcp' }], updated_at: new Date().toISOString(), stack: 'monitoring' },
      { id: 's4', name: 'monitoring_grafana', image: 'grafana/grafana:latest', replicas_running: 1, replicas_desired: 1, ports: [{ published: 3001, target: 3000, protocol: 'tcp' }], updated_at: new Date().toISOString(), stack: 'monitoring' },
      { id: 's5', name: 'api-gateway_kong', image: 'kong:3.4', replicas_running: 2, replicas_desired: 2, ports: [{ published: 8000, target: 8000, protocol: 'tcp' }], updated_at: new Date().toISOString(), stack: 'api-gateway' },
    ];

    let currentContainers: Container[] = [
      // webstack: nginx + app + db
      { id: 'ws-nginx-1', name: 'webstack-nginx-1', image: 'nginx:alpine', state: 'running', status: 'Up 2 days', created: Date.now() - 172800000, ports: [{ private_port: 80, public_port: 8080, port_type: 'tcp' }], project: 'webstack', node: 'worker-01' },
      { id: 'ws-app-1', name: 'webstack-app-1', image: 'node:20-alpine', state: 'running', status: 'Up 2 days', created: Date.now() - 172800000, ports: [{ private_port: 3000, public_port: 3000, port_type: 'tcp' }], project: 'webstack', node: 'worker-02' },
      { id: 'ws-db-1', name: 'webstack-db-1', image: 'postgres:16', state: 'running', status: 'Up 2 days', created: Date.now() - 172800000, ports: [], project: 'webstack', node: 'manager-01' },
      // monitoring: prometheus + grafana + node-exporter
      { id: 'mon-prom-1', name: 'monitoring-prometheus-1', image: 'prom/prometheus:latest', state: 'running', status: 'Up 5 hours', created: Date.now() - 18000000, ports: [{ private_port: 9090, public_port: 9090, port_type: 'tcp' }], project: 'monitoring', node: 'manager-01' },
      { id: 'mon-graf-1', name: 'monitoring-grafana-1', image: 'grafana/grafana:latest', state: 'running', status: 'Up 5 hours', created: Date.now() - 18000000, ports: [{ private_port: 3000, public_port: 3001, port_type: 'tcp' }], project: 'monitoring', node: 'worker-01' },
      { id: 'mon-exp-1', name: 'monitoring-node-exporter-1', image: 'prom/node-exporter', state: 'running', status: 'Up 5 hours', created: Date.now() - 18000000, ports: [], project: 'monitoring', node: 'worker-02' },
      // redis-cluster: master + replica-1 + replica-2
      { id: 'rc-master-1', name: 'redis-master', image: 'redis:7-alpine', state: 'running', status: 'Up 3 days', created: Date.now() - 259200000, ports: [{ private_port: 6379, public_port: 6379, port_type: 'tcp' }], project: 'redis-cluster', node: 'worker-01' },
      { id: 'rc-rep-1', name: 'redis-replica-1', image: 'redis:7-alpine', state: 'running', status: 'Up 3 days', created: Date.now() - 259200000, ports: [], project: 'redis-cluster', node: 'worker-02' },
      { id: 'rc-rep-2', name: 'redis-replica-2', image: 'redis:7-alpine', state: 'running', status: 'Up 3 days', created: Date.now() - 259200000, ports: [], project: 'redis-cluster', node: 'worker-01' },
      // api-gateway: kong-1 + kong-2 + redis
      { id: 'ag-kong-1', name: 'api-gateway-kong-1', image: 'kong:3.4', state: 'running', status: 'Up 1 day', created: Date.now() - 86400000, ports: [{ private_port: 8000, public_port: 8000, port_type: 'tcp' }], project: 'api-gateway', node: 'worker-01' },
      { id: 'ag-kong-2', name: 'api-gateway-kong-2', image: 'kong:3.4', state: 'running', status: 'Up 1 day', created: Date.now() - 86400000, ports: [], project: 'api-gateway', node: 'worker-02' },
      { id: 'ag-redis-1', name: 'api-gateway-redis-1', image: 'redis:7-alpine', state: 'running', status: 'Up 1 day', created: Date.now() - 86400000, ports: [], project: 'api-gateway', node: 'manager-01' },
      // frontend: next + cache
      { id: 'fe-next-1', name: 'frontend-next-1', image: 'node:20-alpine', state: 'running', status: 'Up 1 hour', created: Date.now() - 3600000, ports: [{ private_port: 3000, public_port: 3002, port_type: 'tcp' }], project: 'frontend', node: 'worker-02' },
      { id: 'fe-cache-1', name: 'frontend-cache-1', image: 'memcached:alpine', state: 'running', status: 'Up 1 hour', created: Date.now() - 3600000, ports: [], project: 'frontend', node: 'worker-01' },
    ];

    const emitState = () => {
      const state: DashboardState = {
        mode: 'swarm',
        nodes: showcaseNodes,
        services: showcaseServices,
        containers: [...currentContainers],
        timestamp: new Date().toISOString(),
      };
      lastDashboardState = state;
      onState(state);
    };

    // Scripted incidents cycle: crash → restart → spawn → remove (every 5-10s)
    const incidents: Array<() => void> = [
      // 0: crash — first running container → exited
      () => {
        const idx = currentContainers.findIndex(c => c.state === 'running');
        if (idx >= 0) {
          currentContainers = currentContainers.map((c, i) =>
            i === idx ? { ...c, state: 'exited', status: 'Exited (1)' } : c
          );
          emitState();
        }
      },
      // 1: restart — first exited container → restarting → running after 3s
      () => {
        const idx = currentContainers.findIndex(c => c.state === 'exited');
        if (idx >= 0) {
          currentContainers = currentContainers.map((c, i) =>
            i === idx ? { ...c, state: 'restarting', status: 'Restarting (0)' } : c
          );
          emitState();
          setTimeout(() => {
            currentContainers = currentContainers.map(c =>
              c.state === 'restarting' ? { ...c, state: 'running', status: 'Up a second' } : c
            );
            emitState();
          }, 3000);
        }
      },
      // 2: spawn — add ephemeral worker to webstack
      () => {
        const newId = `ws-worker-${Date.now()}`;
        currentContainers = [
          ...currentContainers,
          { id: newId, name: `webstack-worker-${currentContainers.length}`, image: 'node:20-alpine', state: 'running', status: 'Up a second', created: Date.now(), ports: [], project: 'webstack', node: 'worker-01' },
        ];
        emitState();
      },
      // 3: remove — remove any ephemeral worker that was spawned
      () => {
        const idx = currentContainers.findIndex(c => c.id.startsWith('ws-worker-'));
        if (idx >= 0) {
          currentContainers = currentContainers.filter((_, i) => i !== idx);
          emitState();
        }
      },
    ];

    let incidentIdx = 0;
    const scheduleNextIncident = () => {
      const delay = 5000 + Math.random() * 5000; // 5–10 seconds
      reconnectTimer = setTimeout(() => {
        incidents[incidentIdx % incidents.length]();
        incidentIdx++;
        scheduleNextIncident();
      }, delay);
    };

    emitState();
    scheduleNextIncident();

    return {
      disconnect: () => {
        clearTimeout(reconnectTimer);
        onStatus('disconnected');
      }
    };
  } else {
    connect();
  }

  return { disconnect };
}

// REST API helpers - include auth header
function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchTasks(serviceId: string): Promise<SwarmTask[]> {
  const res = await fetch(`/api/services/${serviceId}/tasks`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function scaleService(serviceId: string, replicas: number): Promise<void> {
  const res = await fetch(`/api/services/${serviceId}/scale`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ replicas })
  });
  if (!res.ok) throw new Error(`Failed to scale service: ${res.status}`);
}

export async function containerAction(containerId: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  const res = await fetch(`/api/containers/${containerId}/action`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action })
  });
  if (!res.ok) throw new Error(`Failed to ${action} container: ${res.status}`);
}

export interface DockerImage {
  id: string;
  repo_tags: string[];
  size: number;
  created: number;
  containers: number;
}

export async function fetchImages(): Promise<DockerImage[]> {
  const res = await fetch('/api/images', { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch images: ${res.status}`);
  return res.json();
}

export async function deleteImage(imageId: string): Promise<void> {
  const res = await fetch(`/api/images/${imageId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete image: ${res.status}`);
}

export interface ContainerInspectInfo {
  id: string;
  name: string;
  config: {
    env: string[];
    image: string;
  };
  mounts: {
    type: string;
    source: string;
    destination: string;
    mode: string;
  }[];
  network_settings: {
    ports: Record<string, { host_ip: string; host_port: string }[] | null>;
    networks: Record<string, {
      ip_address: string;
      gateway: string;
    }>;
  };
}

export async function fetchContainerInspect(containerId: string): Promise<ContainerInspectInfo> {
  const res = await fetch(`/api/containers/${containerId}/inspect`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to inspect container: ${res.status}`);
  return res.json();
}
