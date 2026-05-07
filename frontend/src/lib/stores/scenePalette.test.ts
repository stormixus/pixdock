import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

const LS_KEY = 'pd_scene_palette';

async function loadScenePalette() {
  vi.resetModules();
  return import('./scenePalette');
}

const COLOR_FIELDS = [
  'bgDark', 'bgLight', 'rackFrame', 'rackBg',
  'ledRunning', 'ledStopped', 'ledOther',
  'textPrimary', 'textSecondary', 'textAccent',
  'borderPrimary', 'borderAccent', 'cardBg',
  'glowGreen', 'glowRed', 'glowYellow',
] as const;

function isValidCssColor(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value);
}

function expectValidPalette(palette: Record<string, unknown>) {
  for (const field of COLOR_FIELDS) {
    expect(
      isValidCssColor(palette[field]),
      `field "${field}" should be a valid CSS color: got ${palette[field]}`,
    ).toBe(true);
  }
}

describe('currentScenePalette', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it('defaults to the Classic preset', async () => {
    const { currentScenePalette, scenePalettePresets } = await loadScenePalette();
    const classic = scenePalettePresets.find(p => p.name === 'Classic');
    expect(classic).toBeDefined();
    expect(get(currentScenePalette)).toEqual(classic);
  });

  it('applying a preset updates all 16 color values', async () => {
    const { currentScenePalette, scenePalettePresets } = await loadScenePalette();
    const other = scenePalettePresets.find(p => p.name !== 'Classic')!;
    expect(other).toBeDefined();
    currentScenePalette.set(other);
    const current = get(currentScenePalette) as Record<string, unknown>;
    expect(current).toEqual(other);
    expectValidPalette(current);
  });

  it('persists custom palette to localStorage as pd_scene_palette', async () => {
    const { currentScenePalette, scenePalettePresets } = await loadScenePalette();
    const preset = scenePalettePresets[1];
    currentScenePalette.set(preset);
    const raw = localStorage.getItem(LS_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(preset);
  });

  it('loading from localStorage restores a custom palette', async () => {
    const custom = {
      name: 'Custom',
      bgDark: '#1a2b3c', bgLight: '#4d5e6f',
      rackFrame: '#7a8b9c', rackBg: '#010203',
      ledRunning: '#00ff00', ledStopped: '#ff0000', ledOther: '#ffff00',
      textPrimary: '#ffffff', textSecondary: '#aabbcc', textAccent: '#ddeeff',
      borderPrimary: '#111111', borderAccent: '#222222', cardBg: '#333333',
      glowGreen: '#44ff44', glowRed: '#ff4444', glowYellow: '#ffff44',
    };
    localStorage.setItem(LS_KEY, JSON.stringify(custom));
    const { currentScenePalette } = await loadScenePalette();
    expect(get(currentScenePalette)).toEqual(custom);
  });
});

describe('applyScenePalette', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it('sets CSS custom properties on .scene-canvas element', async () => {
    const { applyScenePalette, scenePalettePresets } = await loadScenePalette();
    const el = document.createElement('div');
    el.className = 'scene-canvas';
    document.body.appendChild(el);

    const classic = scenePalettePresets.find(p => p.name === 'Classic')!;
    applyScenePalette(classic);

    expect(el.style.getPropertyValue('--scene-bg-dark')).toBe(classic.bgDark);
    expect(el.style.getPropertyValue('--scene-led-running')).toBe(classic.ledRunning);
    expect(el.style.getPropertyValue('--scene-glow-red')).toBe(classic.glowRed);

    el.remove();
  });
});

describe('scenePalettePresets', () => {
  it('has at least 4 presets', async () => {
    const { scenePalettePresets } = await loadScenePalette();
    expect(scenePalettePresets.length).toBeGreaterThanOrEqual(4);
  });

  it('all presets have valid CSS color values for all 16 fields', async () => {
    const { scenePalettePresets } = await loadScenePalette();
    for (const preset of scenePalettePresets) {
      expectValidPalette(preset as unknown as Record<string, unknown>);
    }
  });

  it('all presets have a non-empty name', async () => {
    const { scenePalettePresets } = await loadScenePalette();
    for (const preset of scenePalettePresets) {
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });
});
