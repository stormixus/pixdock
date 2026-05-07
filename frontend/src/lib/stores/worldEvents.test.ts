import { describe, it, expect } from 'vitest';
import { deriveWorldEvents } from './swarm';
import type { Container } from '$lib/utils/ws';

// Minimal container factory
function mkContainer(id: string, name: string, state: string): Container {
  return { id, name, image: 'test:latest', state, status: state, created: 0, ports: [], project: null };
}

describe('deriveWorldEvents', () => {
  it('returns no events when nothing changed', () => {
    const containers = [
      mkContainer('c1', 'web', 'running'),
      mkContainer('c2', 'db', 'running'),
    ];
    const events = deriveWorldEvents(containers, containers);
    expect(events).toHaveLength(0);
  });

  it('returns container_started for new containers', () => {
    const prev = [mkContainer('c1', 'web', 'running')];
    const next = [mkContainer('c1', 'web', 'running'), mkContainer('c2', 'db', 'running')];
    const events = deriveWorldEvents(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('container_started');
    expect(events[0].containerId).toBe('c2');
    expect(events[0].containerName).toBe('db');
    expect(events[0].newState).toBe('running');
  });

  it('returns container_stopped for removed containers', () => {
    const prev = [mkContainer('c1', 'web', 'running'), mkContainer('c2', 'db', 'running')];
    const next = [mkContainer('c1', 'web', 'running')];
    const events = deriveWorldEvents(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('container_stopped');
    expect(events[0].containerId).toBe('c2');
    expect(events[0].previousState).toBe('running');
  });

  it('returns health_changed when state differs', () => {
    const prev = [mkContainer('c1', 'web', 'running')];
    const next = [mkContainer('c1', 'web', 'exited')];
    const events = deriveWorldEvents(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('health_changed');
    expect(events[0].previousState).toBe('running');
    expect(events[0].newState).toBe('exited');
  });

  it('returns both health_changed and container_restarting when new state is restarting', () => {
    const prev = [mkContainer('c1', 'web', 'running')];
    const next = [mkContainer('c1', 'web', 'restarting')];
    const events = deriveWorldEvents(prev, next);
    const types = events.map((e) => e.type);
    expect(types).toContain('health_changed');
    expect(types).toContain('container_restarting');
    expect(events).toHaveLength(2);
  });

  it('handles empty prev (first load) — all containers are "started"', () => {
    const next = [mkContainer('c1', 'web', 'running'), mkContainer('c2', 'db', 'running')];
    const events = deriveWorldEvents([], next);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'container_started')).toBe(true);
  });

  it('handles empty next — all containers are "stopped"', () => {
    const prev = [mkContainer('c1', 'web', 'running'), mkContainer('c2', 'db', 'running')];
    const events = deriveWorldEvents(prev, []);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'container_stopped')).toBe(true);
  });

  it('handles both empty prev and next — no events', () => {
    const events = deriveWorldEvents([], []);
    expect(events).toHaveLength(0);
  });

  it('handles multiple simultaneous changes', () => {
    const prev = [
      mkContainer('c1', 'web', 'running'),
      mkContainer('c2', 'db', 'running'),
      mkContainer('c3', 'cache', 'running'),
    ];
    const next = [
      mkContainer('c1', 'web', 'exited'),   // health_changed
      mkContainer('c3', 'cache', 'running'), // unchanged
      mkContainer('c4', 'worker', 'running'), // started
      // c2 removed → stopped
    ];
    const events = deriveWorldEvents(prev, next);
    const types = events.map((e) => e.type);
    expect(types).toContain('container_started');   // c4
    expect(types).toContain('container_stopped');   // c2
    expect(types).toContain('health_changed');      // c1
    expect(events).toHaveLength(3);
  });

  it('sets a numeric timestamp on each event', () => {
    const before = Date.now();
    const events = deriveWorldEvents([], [mkContainer('c1', 'web', 'running')]);
    const after = Date.now();
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(events[0].timestamp).toBeLessThanOrEqual(after);
  });
});
