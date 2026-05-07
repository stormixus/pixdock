import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// ─── Web Audio API mock ───────────────────────────────────────────────────────
// Mirrors what sound.ts actually calls on the Web Audio objects.
const mockOscillator = {
  type: '' as OscillatorType,
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGain = {
  gain: {
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockCtx = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGain),
  destination: {},
  currentTime: 0,
  state: 'running' as AudioContextState,
  resume: vi.fn(),
};

// Must use `function` keyword — arrow functions are not constructable (new AudioContext())
const AudioContextMock = vi.fn(function () { return mockCtx; });

// Assign to both globalThis and window (jsdom) before any module loads
globalThis.AudioContext = AudioContextMock as unknown as typeof AudioContext;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resetAudioMocks() {
  mockOscillator.connect.mockClear();
  mockOscillator.start.mockClear();
  mockOscillator.stop.mockClear();
  mockGain.gain.setValueAtTime.mockClear();
  mockGain.gain.exponentialRampToValueAtTime.mockClear();
  mockGain.connect.mockClear();
  mockCtx.createOscillator.mockClear();
  mockCtx.createGain.mockClear();
  mockCtx.resume.mockClear();
  AudioContextMock.mockClear();
}

/** Fresh module import — resets ctx singleton and store state each test. */
async function loadSound() {
  vi.resetModules();
  // Re-apply mock after module reset in case the module re-reads the global
  globalThis.AudioContext = AudioContextMock as unknown as typeof AudioContext;
  return import('./sound');
}

// ─── soundEnabled store ───────────────────────────────────────────────────────
describe('soundEnabled store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to false', async () => {
    const { soundEnabled } = await loadSound();
    expect(get(soundEnabled)).toBe(false);
  });

  it('persists true to localStorage key pd_sound', async () => {
    const { soundEnabled } = await loadSound();
    soundEnabled.set(true);
    expect(localStorage.getItem('pd_sound')).toBe('true');
  });

  it('persists false to localStorage key pd_sound', async () => {
    const { soundEnabled } = await loadSound();
    soundEnabled.set(true);
    soundEnabled.set(false);
    expect(localStorage.getItem('pd_sound')).toBe('false');
  });

  it('reads persisted value from localStorage on init', async () => {
    localStorage.setItem('pd_sound', 'true');
    const { soundEnabled } = await loadSound();
    expect(get(soundEnabled)).toBe(true);
  });
});

// ─── soundVolume store ────────────────────────────────────────────────────────
describe('soundVolume store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to 0.5', async () => {
    const { soundVolume } = await loadSound();
    expect(get(soundVolume)).toBe(0.5);
  });

  it('persists to localStorage as pd_volume', async () => {
    const { soundVolume } = await loadSound();
    soundVolume.set(0.8);
    expect(localStorage.getItem('pd_volume')).toBe('0.8');
  });

  it('reads persisted volume from localStorage on init', async () => {
    localStorage.setItem('pd_volume', '0.3');
    const { soundVolume } = await loadSound();
    expect(get(soundVolume)).toBe(0.3);
  });
});

// ─── initSound ────────────────────────────────────────────────────────────────
describe('initSound', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates an AudioContext on first call', async () => {
    const { initSound } = await loadSound();
    initSound();
    expect(AudioContextMock).toHaveBeenCalledOnce();
  });

  it('does not create a second AudioContext on repeated calls', async () => {
    const { initSound } = await loadSound();
    initSound();
    initSound();
    expect(AudioContextMock).toHaveBeenCalledOnce();
  });
});

// ─── playWorldEvent ───────────────────────────────────────────────────────────
describe('playWorldEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does nothing when sound has not been initialized (soundEnabled is false)', async () => {
    const { playWorldEvent } = await loadSound();
    // initSound never called → ctx is null → function returns early
    playWorldEvent({
      type: 'container_started',
      containerId: 'c1',
      containerName: 'web',
      newState: 'running',
      timestamp: Date.now(),
    });
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });

  it('maps container_started to ascending beep (calls oscillator + start)', async () => {
    const { playWorldEvent, initSound } = await loadSound();
    initSound();
    playWorldEvent({
      type: 'container_started',
      containerId: 'c1',
      containerName: 'web',
      newState: 'running',
      timestamp: Date.now(),
    });
    // sfxContainerStarted plays 2 tones → 2 oscillators created
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it('maps container_stopped to descending tone (calls oscillator + start)', async () => {
    const { playWorldEvent, initSound } = await loadSound();
    initSound();
    playWorldEvent({
      type: 'container_stopped',
      containerId: 'c2',
      containerName: 'db',
      previousState: 'running',
      timestamp: Date.now(),
    });
    // sfxContainerStopped plays 2 tones → 2 oscillators
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it('maps health_changed to exited/dead state to a buzz', async () => {
    const { playWorldEvent, initSound } = await loadSound();
    initSound();
    playWorldEvent({
      type: 'health_changed',
      containerId: 'c3',
      containerName: 'api',
      previousState: 'running',
      newState: 'exited',
      timestamp: Date.now(),
    });
    // sfxHealthError plays 1 tone
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });
});

// ─── playClick ────────────────────────────────────────────────────────────────
describe('playClick', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('plays click feedback sound after initSound', async () => {
    const { playClick, initSound } = await loadSound();
    initSound();
    playClick();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does nothing when ctx is not initialized', async () => {
    const { playClick } = await loadSound();
    // No initSound called
    playClick();
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });
});
