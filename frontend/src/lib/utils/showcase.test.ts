import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWebSocket } from './ws';
import type { DashboardState } from './ws';

describe('createWebSocket showcase mode', () => {
  let states: DashboardState[] = [];
  let statuses: string[] = [];
  let disconnect: (() => void) | undefined;

  beforeEach(() => {
    states = [];
    statuses = [];
    localStorage.setItem('pd_mock_mode', 'true');
  });

  afterEach(() => {
    disconnect?.();
    localStorage.removeItem('pd_mock_mode');
    vi.useRealTimers();
  });

  it('reports connected status immediately', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      (status) => statuses.push(status)
    );
    disconnect = result.disconnect;
    expect(statuses).toContain('connected');
  });

  it('emits initial state synchronously with showcase fleet', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = result.disconnect;

    expect(states.length).toBeGreaterThanOrEqual(1);
    const initial = states[0];
    expect(initial.mode).toBe('swarm');
    expect(initial.nodes).toHaveLength(3);
    expect(initial.containers).toHaveLength(14);
    expect(initial.services).toHaveLength(5);
  });

  it('includes all 5 showcase projects in containers', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = result.disconnect;

    const projectNames = new Set(states[0].containers.map(c => c.project));
    expect(projectNames).toContain('webstack');
    expect(projectNames).toContain('monitoring');
    expect(projectNames).toContain('redis-cluster');
    expect(projectNames).toContain('api-gateway');
    expect(projectNames).toContain('frontend');
  });

  it('includes all 3 nodes with correct hostnames and roles', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = result.disconnect;

    const { nodes } = states[0];
    const manager = nodes.find(n => n.role === 'manager');
    const workers = nodes.filter(n => n.role === 'worker');

    expect(manager?.hostname).toBe('manager-01');
    expect(workers.map(n => n.hostname).sort()).toEqual(['worker-01', 'worker-02']);
  });

  it('initial fleet has all containers running', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = result.disconnect;

    const nonRunning = states[0].containers.filter(c => c.state !== 'running');
    expect(nonRunning).toHaveLength(0);
  });

  it('crash incident: a running container becomes exited', () => {
    vi.useFakeTimers();
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = () => result.disconnect();

    // Advance past max incident delay (10s) to fire the crash incident
    vi.advanceTimersByTime(11000);

    expect(states.length).toBeGreaterThan(1);
    // Check any emitted state had an exited container — the restart incident
    // may fire in the same window and transition it back to restarting/running
    const hadExited = states.some(s => s.containers.some(c => c.state === 'exited'));
    expect(hadExited).toBe(true);
  });

  it('restart incident: crashed container goes restarting then running', () => {
    vi.useFakeTimers();
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = () => result.disconnect();

    // Fire crash (incident 0) then restart (incident 1)
    vi.advanceTimersByTime(11000); // crash fires
    vi.advanceTimersByTime(11000); // restart fires (restarting state)

    const restartingState = states.find(s => s.containers.some(c => c.state === 'restarting'));
    expect(restartingState).toBeDefined();

    // Advance 3s for the inner setTimeout to resolve restarting → running
    vi.advanceTimersByTime(3000);

    const latestAfterResolve = states[states.length - 1];
    const stillRestarting = latestAfterResolve.containers.filter(c => c.state === 'restarting');
    expect(stillRestarting).toHaveLength(0);
  });

  it('spawn incident: adds a new container to webstack', () => {
    vi.useFakeTimers();
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = () => result.disconnect();

    // Fire incidents 0 (crash), 1 (restart), 2 (spawn)
    vi.advanceTimersByTime(11000); // crash
    vi.advanceTimersByTime(11000); // restart
    vi.advanceTimersByTime(11000); // spawn

    // Check any emitted state had the ephemeral worker — the remove incident
    // may fire in the same window and take the container back out
    const hadSpawned = states.some(
      s => s.containers.some(c => c.project === 'webstack' && c.id.startsWith('ws-worker-'))
    );
    expect(hadSpawned).toBe(true);
  });

  it('remove incident: removes the spawned ephemeral worker', () => {
    vi.useFakeTimers();
    // Pin Math.random so incident delay is deterministic (5000 + 0.5*5000 = 7500ms)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = () => result.disconnect();

    // Fire all 4 incidents: crash, restart, spawn, remove
    // Each incident schedules at 7500ms; advance 8000ms per step to guarantee firing
    vi.advanceTimersByTime(8000); // crash
    vi.advanceTimersByTime(8000); // restart
    vi.advanceTimersByTime(4000); // restart's nested 3s timer resolves
    vi.advanceTimersByTime(8000); // spawn
    vi.advanceTimersByTime(8000); // remove

    const latest = states[states.length - 1];
    const ephemeral = latest.containers.filter(c => c.id.startsWith('ws-worker-'));
    expect(ephemeral).toHaveLength(0);

    randomSpy.mockRestore();
  });

  it('calls onStatus disconnected when disconnect() is invoked', () => {
    const result = createWebSocket(
      (s) => states.push(s),
      (status) => statuses.push(status)
    );
    result.disconnect();
    expect(statuses).toContain('disconnected');
  });

  it('each emitted state has a valid timestamp', () => {
    vi.useFakeTimers();
    const result = createWebSocket(
      (s) => states.push(s),
      () => {}
    );
    disconnect = () => result.disconnect();

    vi.advanceTimersByTime(11000);

    for (const state of states) {
      expect(() => new Date(state.timestamp)).not.toThrow();
      expect(new Date(state.timestamp).getTime()).not.toBeNaN();
    }
  });
});
