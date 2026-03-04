import { writable, derived } from 'svelte/store';
import { createWebSocket, type DashboardState, type ConnectionStatus, type DockerMode } from '$lib/utils/ws';

export const dashboardState = writable<DashboardState>({
  mode: 'standalone',
  nodes: [],
  services: [],
  containers: [],
  timestamp: ''
});

export const connectionStatus = writable<ConnectionStatus>('disconnected');

// Toast notifications
export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

let toastId = 0;
export const toasts = writable<Toast[]>([]);

export function addToast(message: string, type: Toast['type'] = 'info') {
  const id = ++toastId;
  toasts.update((t) => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }, 4000);
}

// Derived stores
export const dockerMode = derived(dashboardState, ($s) => $s.mode);
export const nodes = derived(dashboardState, ($s) => $s.nodes);
export const services = derived(dashboardState, ($s) => $s.services);
export const containers = derived(dashboardState, ($s) => $s.containers);

// Running containers only
export const runningContainers = derived(dashboardState, ($s) =>
  $s.containers.filter((c) => c.state === 'running')
);

// Containers grouped by compose project
export const projects = derived(dashboardState, ($s) => {
  const grouped = new Map<string, typeof $s.containers>();

  for (const ctr of $s.containers) {
    const project = ctr.project ?? '_standalone';
    if (!grouped.has(project)) {
      grouped.set(project, []);
    }
    grouped.get(project)!.push(ctr);
  }

  return grouped;
});

// Services grouped by stack (swarm mode)
export const stacks = derived(dashboardState, ($s) => {
  const grouped = new Map<string, typeof $s.services>();

  for (const svc of $s.services) {
    const stack = svc.stack ?? '_standalone';
    if (!grouped.has(stack)) {
      grouped.set(stack, []);
    }
    grouped.get(stack)!.push(svc);
  }

  return grouped;
});

// Summary stats
export const stats = derived(dashboardState, ($s) => ({
  // Swarm
  totalNodes: $s.nodes.length,
  readyNodes: $s.nodes.filter((n) => n.status === 'ready').length,
  totalServices: $s.services.length,
  healthyServices: $s.services.filter((s) => s.replicas_running >= s.replicas_desired).length,
  // Standalone
  totalContainers: $s.containers.length,
  runningContainers: $s.containers.filter((c) => c.state === 'running').length,
}));

// Init WebSocket connection
export function initSwarmConnection(onAuthError?: () => void) {
  let prevStatus: ConnectionStatus = 'disconnected';

  return createWebSocket(
    (state) => dashboardState.set(state),
    (status) => {
      connectionStatus.set(status);
      if (status !== prevStatus) {
        if (status === 'connected') addToast('LINK ESTABLISHED', 'success');
        else if (status === 'disconnected' && prevStatus === 'connected')
          addToast('CONNECTION LOST', 'error');
        prevStatus = status;
      }
    },
    onAuthError
  );
}
