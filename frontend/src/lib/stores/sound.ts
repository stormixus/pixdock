import { writable, get } from 'svelte/store';
import { worldEvents } from './swarm';
import type { WorldEvent } from './swarm';

// ─── Note frequencies (Hz) ───
const NOTE = {
  A2:  110.00,
  C4:  261.63,
  E4:  329.63,
  G4:  392.00,
  C5:  523.25,
  E5:  659.25,
  C6: 1046.50,
  E6: 1318.51,
  G6: 1567.98,
} as const;

// ─── localStorage keys ───
const LS_SOUND  = 'pd_sound';
const LS_VOLUME = 'pd_volume';

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}

function loadFloat(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
}

// ─── Exported stores (sound OFF on first visit) ───
export const soundEnabled = writable<boolean>(
  typeof localStorage !== 'undefined' ? loadBool(LS_SOUND, false) : false
);
export const soundVolume = writable<number>(
  typeof localStorage !== 'undefined' ? loadFloat(LS_VOLUME, 0.5) : 0.5
);

// Persist changes to localStorage
soundEnabled.subscribe((v) => {
  try { localStorage.setItem(LS_SOUND, String(v)); } catch { /* ignore */ }
});
soundVolume.subscribe((v) => {
  try { localStorage.setItem(LS_VOLUME, String(v)); } catch { /* ignore */ }
});

// ─── AudioContext singleton ───
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

/** Resolve AudioContext constructor from globalThis (supports webkit prefix + test mocks). */
function resolveAudioCtor(): ((new () => AudioContext) | (() => AudioContext)) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Create an AudioContext instance, handling test environments where the mock is not constructable. */
function newAudioContext(): AudioContext | null {
  const Ctor = resolveAudioCtor();
  if (!Ctor) return null;
  try {
    // Standard browser path
    return new (Ctor as new () => AudioContext)();
  } catch {
    // Fallback for test mocks using vi.fn(arrow) which are not constructable
    try {
      return (Ctor as () => AudioContext)();
    } catch {
      return null;
    }
  }
}

export function initSound(): void {
  if (!resolveAudioCtor()) return;

  if (!ctx) {
    ctx = newAudioContext();
    if (!ctx) return;

    masterGain = ctx.createGain();
    masterGain.gain.value = get(soundVolume);
    masterGain.connect(ctx.destination);

    // Keep master gain synced with store
    soundVolume.subscribe((v) => {
      if (masterGain) masterGain.gain.value = v;
    });
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ });
  }
}

// ─── Primitive tone builder ───
function playTone(
  audioCtx: AudioContext,
  gain: GainNode,
  freq: number,
  duration: number,
  type: OscillatorType,
  startTime: number,
  volume = 0.3
): void {
  const osc   = audioCtx.createOscillator();
  const gNode = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gNode.gain.setValueAtTime(volume, startTime);
  gNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gNode);
  gNode.connect(gain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ─── SFX functions ───

function sfxContainerStarted(audioCtx: AudioContext, gain: GainNode): void {
  // Ascending two-tone beep: C5→E5, 100ms each, square
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.C5, 0.1, 'square', t);
  playTone(audioCtx, gain, NOTE.E5, 0.1, 'square', t + 0.1);
}

function sfxContainerStopped(audioCtx: AudioContext, gain: GainNode): void {
  // Descending tone: E4→C4, 75ms each (150ms total), square
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.E4, 0.075, 'square', t);
  playTone(audioCtx, gain, NOTE.C4, 0.075, 'square', t + 0.075);
}

function sfxContainerRestarting(audioCtx: AudioContext, gain: GainNode): void {
  // Three rapid pips: G4, 50ms each, 50ms gaps, square
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.G4, 0.05, 'square', t);
  playTone(audioCtx, gain, NOTE.G4, 0.05, 'square', t + 0.1);
  playTone(audioCtx, gain, NOTE.G4, 0.05, 'square', t + 0.2);
}

function sfxHealthError(audioCtx: AudioContext, gain: GainNode): void {
  // Low buzz: A2, 200ms, sawtooth
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.A2, 0.2, 'sawtooth', t, 0.25);
}

function sfxHealthRunning(audioCtx: AudioContext, gain: GainNode): void {
  // Sparkle chime: C6→E6→G6, 60ms each, sine
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.C6, 0.06, 'sine', t);
  playTone(audioCtx, gain, NOTE.E6, 0.06, 'sine', t + 0.06);
  playTone(audioCtx, gain, NOTE.G6, 0.06, 'sine', t + 0.12);
}

function sfxClick(audioCtx: AudioContext, gain: GainNode): void {
  // Short tick: C5, 30ms, square
  const t = audioCtx.currentTime;
  playTone(audioCtx, gain, NOTE.C5, 0.03, 'square', t, 0.2);
}

// ─── Public API ───

export function playWorldEvent(event: WorldEvent): void {
  if (!ctx || !masterGain) return;

  switch (event.type) {
    case 'container_started':
      sfxContainerStarted(ctx, masterGain);
      break;
    case 'container_stopped':
      sfxContainerStopped(ctx, masterGain);
      break;
    case 'container_restarting':
      sfxContainerRestarting(ctx, masterGain);
      break;
    case 'health_changed':
      if (event.newState === 'exited' || event.newState === 'dead') {
        sfxHealthError(ctx, masterGain);
      } else if (event.newState === 'running' && event.previousState !== 'running') {
        sfxHealthRunning(ctx, masterGain);
      }
      break;
  }
}

export function playClick(): void {
  if (!ctx || !masterGain) return;
  sfxClick(ctx, masterGain);
}

// ─── World event subscription (browser only) ───
if (typeof globalThis.AudioContext !== 'undefined' || typeof (globalThis as any).webkitAudioContext !== 'undefined') {
  worldEvents.subscribe((events) => {
    if (!get(soundEnabled) || events.length === 0) return;
    for (const event of events) {
      playWorldEvent(event);
    }
  });
}
