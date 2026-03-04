import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  dashboardState,
  nodes,
  services,
  containers,
  runningContainers,
  projects,
  stacks,
  stats,
  toasts,
  addToast,
  dockerMode,
} from './swarm';
import type { DashboardState } from '$lib/utils/ws';

// Helper to set dashboard state
function setState(partial: Partial<DashboardState>) {
  dashboardState.set({
    mode: 'standalone',
    nodes: [],
    services: [],
    containers: [],
    timestamp: '2024-01-01T00:00:00Z',
    ...partial,
  });
}

describe('Derived stores', () => {
  beforeEach(() => {
    setState({});
  });

  it('should derive dockerMode from dashboardState', () => {
    setState({ mode: 'swarm' });
    expect(get(dockerMode)).toBe('swarm');

    setState({ mode: 'standalone' });
    expect(get(dockerMode)).toBe('standalone');
  });

  it('should derive nodes from dashboardState', () => {
    const mockNodes = [
      {
        id: 'n1', hostname: 'node-1', role: 'manager', status: 'ready',
        availability: 'active', engine_version: '24.0', ip: '10.0.0.1',
        os: 'linux', arch: 'x86_64', cpus: 4, memory_bytes: 8_000_000_000,
      },
    ];
    setState({ mode: 'swarm', nodes: mockNodes });
    expect(get(nodes)).toEqual(mockNodes);
  });

  it('should filter running containers', () => {
    setState({
      containers: [
        { id: 'c1', name: 'web', image: 'nginx', state: 'running', status: 'Up', created: 0, ports: [], project: null },
        { id: 'c2', name: 'db', image: 'postgres', state: 'exited', status: 'Exited', created: 0, ports: [], project: null },
        { id: 'c3', name: 'cache', image: 'redis', state: 'running', status: 'Up', created: 0, ports: [], project: null },
      ],
    });
    const running = get(runningContainers);
    expect(running.length).toBe(2);
    expect(running.map((c) => c.name)).toEqual(['web', 'cache']);
  });

  it('should group containers by project', () => {
    setState({
      containers: [
        { id: 'c1', name: 'web', image: 'nginx', state: 'running', status: 'Up', created: 0, ports: [], project: 'myapp' },
        { id: 'c2', name: 'db', image: 'postgres', state: 'running', status: 'Up', created: 0, ports: [], project: 'myapp' },
        { id: 'c3', name: 'redis', image: 'redis', state: 'running', status: 'Up', created: 0, ports: [], project: null },
      ],
    });
    const grouped = get(projects);
    expect(grouped.get('myapp')?.length).toBe(2);
    expect(grouped.get('_standalone')?.length).toBe(1);
  });

  it('should group services by stack', () => {
    setState({
      mode: 'swarm',
      services: [
        { id: 's1', name: 'web', image: 'nginx', replicas_running: 3, replicas_desired: 3, ports: [], updated_at: '', stack: 'prod' },
        { id: 's2', name: 'api', image: 'node', replicas_running: 2, replicas_desired: 2, ports: [], updated_at: '', stack: 'prod' },
        { id: 's3', name: 'monitor', image: 'grafana', replicas_running: 1, replicas_desired: 1, ports: [], updated_at: '', stack: null },
      ],
    });
    const grouped = get(stacks);
    expect(grouped.get('prod')?.length).toBe(2);
    expect(grouped.get('_standalone')?.length).toBe(1);
  });

  it('should compute stats correctly for standalone mode', () => {
    setState({
      containers: [
        { id: 'c1', name: 'web', image: 'nginx', state: 'running', status: 'Up', created: 0, ports: [], project: null },
        { id: 'c2', name: 'db', image: 'postgres', state: 'exited', status: 'Exited', created: 0, ports: [], project: null },
        { id: 'c3', name: 'cache', image: 'redis', state: 'running', status: 'Up', created: 0, ports: [], project: null },
      ],
    });
    const s = get(stats);
    expect(s.totalContainers).toBe(3);
    expect(s.runningContainers).toBe(2);
  });

  it('should compute stats correctly for swarm mode', () => {
    setState({
      mode: 'swarm',
      nodes: [
        { id: 'n1', hostname: 'h1', role: 'manager', status: 'ready', availability: 'active', engine_version: '', ip: '', os: '', arch: '', cpus: 0, memory_bytes: 0 },
        { id: 'n2', hostname: 'h2', role: 'worker', status: 'down', availability: 'active', engine_version: '', ip: '', os: '', arch: '', cpus: 0, memory_bytes: 0 },
      ],
      services: [
        { id: 's1', name: 'web', image: 'nginx', replicas_running: 3, replicas_desired: 3, ports: [], updated_at: '', stack: null },
        { id: 's2', name: 'api', image: 'node', replicas_running: 1, replicas_desired: 3, ports: [], updated_at: '', stack: null },
      ],
    });
    const s = get(stats);
    expect(s.totalNodes).toBe(2);
    expect(s.readyNodes).toBe(1);
    expect(s.totalServices).toBe(2);
    expect(s.healthyServices).toBe(1);
  });

  it('should handle empty state', () => {
    setState({});
    expect(get(containers)).toEqual([]);
    expect(get(nodes)).toEqual([]);
    expect(get(services)).toEqual([]);
    expect(get(runningContainers)).toEqual([]);
    expect(get(projects).size).toBe(0);
    expect(get(stacks).size).toBe(0);
    const s = get(stats);
    expect(s.totalContainers).toBe(0);
    expect(s.runningContainers).toBe(0);
  });
});

describe('Toast system', () => {
  beforeEach(() => {
    toasts.set([]);
  });

  it('should add a toast', () => {
    addToast('Test message', 'info');
    const t = get(toasts);
    expect(t.length).toBe(1);
    expect(t[0].message).toBe('Test message');
    expect(t[0].type).toBe('info');
  });

  it('should add multiple toasts with unique IDs', () => {
    addToast('First', 'info');
    addToast('Second', 'error');
    const t = get(toasts);
    expect(t.length).toBe(2);
    expect(t[0].id).not.toBe(t[1].id);
  });
});
