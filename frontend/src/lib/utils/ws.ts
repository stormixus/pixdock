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
  node?: string; // added for mock UI support
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

export function createWebSocket(
  onState: (state: DashboardState) => void,
  onStatus: (status: ConnectionStatus) => void,
  onAuthError?: () => void
) {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let reconnectAttempt = 0;

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
      reconnectAttempt = 0; // Reset backoff on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const state: DashboardState = JSON.parse(event.data);
        onState(state);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = (event) => {
      // Code 1008 = Policy Violation (used for 401 Unauthorized on WS upgrade)
      if (event.code === 1008 || event.code === 4001) {
        onStatus('disconnected');
        onAuthError?.();
        return; // Do not reconnect on auth failure
      }
      onStatus('disconnected');
      // Exponential backoff with jitter
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
  }

  if (localStorage.getItem('pd_mock_mode') === 'true') {
    onStatus('connected');
    const simulateData = () => {
      const state: DashboardState = {
        mode: 'swarm',
        nodes: [
          { id: 'n1', hostname: 'mgr-alpha', role: 'manager', status: 'ready', availability: 'active', engine_version: '24.0.5', ip: '192.168.1.10', os: 'linux', arch: 'x86_64', cpus: 4, memory_bytes: 16 * 1024 ** 3 },
          { id: 'n2', hostname: 'wrk-bravo', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0.5', ip: '192.168.1.11', os: 'linux', arch: 'x86_64', cpus: 8, memory_bytes: 32 * 1024 ** 3 },
          { id: 'n3', hostname: 'wrk-charlie', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0.5', ip: '192.168.1.12', os: 'linux', arch: 'x86_64', cpus: 8, memory_bytes: 32 * 1024 ** 3 },
        ],
        services: [
          { id: 's1', name: 'api-gateway', image: 'nginx:alpine', replicas_running: 3, replicas_desired: 3, ports: [{ published: 80, target: 80, protocol: 'tcp' }], updated_at: new Date().toISOString(), stack: 'core' },
          { id: 's2', name: 'auth-service', image: 'pixdock/auth:v1', replicas_running: 2, replicas_desired: 2, ports: [], updated_at: new Date().toISOString(), stack: 'core' },
          { id: 's3', name: 'redis-cache', image: 'redis:7', replicas_running: 1, replicas_desired: 1, ports: [], updated_at: new Date().toISOString(), stack: 'data' },
          { id: 's4', name: 'worker-queue', image: 'pixdock/worker:latest', replicas_running: 5, replicas_desired: 5, ports: [], updated_at: new Date().toISOString(), stack: 'compute' },
          { id: 's5', name: 'db-primary', image: 'postgres:15', replicas_running: 1, replicas_desired: 1, ports: [], updated_at: new Date().toISOString(), stack: 'data' },
        ],
        containers: Array.from({ length: 12 }).map((_, i) => ({
          id: `c${i}abc89xyz`,
          name: `svc_task.1.${i}a9bf`,
          image: i % 2 === 0 ? 'nginx:alpine' : 'pixdock/worker:latest',
          state: i === 11 ? 'exited' : 'running',
          status: 'Up 2 hours',
          created: Date.now() - 7200000,
          ports: [],
          project: i < 5 ? 'core' : i < 10 ? 'compute' : 'data',
          node: ['mgr-alpha', 'wrk-bravo', 'wrk-charlie'][i % 3]
        })),
        timestamp: new Date().toISOString()
      };
      
      // slightly randomize container count based on time to simulate load
      if (Math.random() > 0.8) {
        state.containers.pop();
        state.services[3].replicas_running = 4;
      }
      onState(state);
    };
    
    simulateData();
    reconnectTimer = setInterval(simulateData, 1500);
    
    return { 
      disconnect: () => {
        clearInterval(reconnectTimer);
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
