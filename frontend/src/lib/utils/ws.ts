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

export function createWebSocket(
  onState: (state: DashboardState) => void,
  onStatus: (status: ConnectionStatus) => void
) {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;

  function connect() {
    onStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      onStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const state: DashboardState = JSON.parse(event.data);
        onState(state);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      onStatus('disconnected');
      reconnectTimer = setTimeout(connect, 3000);
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

// REST API helpers
export async function fetchTasks(serviceId: string): Promise<SwarmTask[]> {
  const res = await fetch(`/api/services/${serviceId}/tasks`);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function scaleService(serviceId: string, replicas: number): Promise<void> {
  const res = await fetch(`/api/services/${serviceId}/scale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replicas })
  });
  if (!res.ok) throw new Error(`Failed to scale service: ${res.status}`);
}

export async function containerAction(containerId: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
  const res = await fetch(`/api/containers/${containerId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!res.ok) throw new Error(`Failed to ${action} container: ${res.status}`);
}
