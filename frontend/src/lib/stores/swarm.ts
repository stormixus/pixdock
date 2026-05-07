import { writable, derived, get } from 'svelte/store';
import { createWebSocket, type DashboardState, type ConnectionStatus, type DockerMode, type Container } from '$lib/utils/ws';

// ---------------------------------------------------------------------------
// World Events — computed diffs between consecutive dashboard states
// ---------------------------------------------------------------------------

export interface WorldEvent {
  type: 'container_started' | 'container_stopped' | 'health_changed' | 'container_restarting';
  containerId: string;
  containerName: string;
  previousState?: string;
  newState?: string;
  timestamp: number;
}

export function deriveWorldEvents(prev: Container[], next: Container[]): WorldEvent[] {
  const events: WorldEvent[] = [];
  const now = Date.now();

  const prevMap = new Map(prev.map((c) => [c.id, c]));
  const nextMap = new Map(next.map((c) => [c.id, c]));

  // container_started: present in next but absent in prev
  for (const [id, c] of nextMap) {
    if (!prevMap.has(id)) {
      events.push({ type: 'container_started', containerId: id, containerName: c.name, newState: c.state, timestamp: now });
    }
  }

  // container_stopped: present in prev but absent in next
  for (const [id, c] of prevMap) {
    if (!nextMap.has(id)) {
      events.push({ type: 'container_stopped', containerId: id, containerName: c.name, previousState: c.state, timestamp: now });
    }
  }

  // health_changed / container_restarting: same ID, state changed
  for (const [id, nextC] of nextMap) {
    const prevC = prevMap.get(id);
    if (prevC && prevC.state !== nextC.state) {
      events.push({ type: 'health_changed', containerId: id, containerName: nextC.name, previousState: prevC.state, newState: nextC.state, timestamp: now });
      if (nextC.state === 'restarting') {
        events.push({ type: 'container_restarting', containerId: id, containerName: nextC.name, previousState: prevC.state, newState: nextC.state, timestamp: now });
      }
    }
  }

  return events;
}

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

// Selected container (for click-to-focus slide-out panel)
export const selectedContainer = writable<string | null>(null);

// World events — latest batch of state-change events derived from each WS update
export const worldEvents = writable<WorldEvent[]>([]);

// Init WebSocket connection
export function initSwarmConnection(onAuthError?: () => void) {
  let prevStatus: ConnectionStatus = 'disconnected';
  // Suppress event flood on first snapshot after (re)connect
  let isFirstSnapshot = true;

  return createWebSocket(
    (state) => {
      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        dashboardState.set(state);
        return;
      }
      const prevContainers = get(dashboardState).containers;
      const events = deriveWorldEvents(prevContainers, state.containers);
      worldEvents.set(events);
      dashboardState.set(state);
    },
    (status) => {
      connectionStatus.set(status);
      if (status !== prevStatus) {
        if (status === 'connected') {
          addToast('LINK ESTABLISHED', 'success');
          isFirstSnapshot = true;
        } else if (status === 'disconnected' && prevStatus === 'connected') {
          addToast('CONNECTION LOST', 'error');
          isFirstSnapshot = true;
        }
        prevStatus = status;
      }
    },
    onAuthError
  );
}
