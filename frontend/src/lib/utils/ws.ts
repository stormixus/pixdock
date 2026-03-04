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

  connect();

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
