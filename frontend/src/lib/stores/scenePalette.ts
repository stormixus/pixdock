import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenePalette {
  floor: string;      // scene background dark
  wall: string;       // scene background light / shell
  ceiling: string;    // scene ceiling / upper overlay
  ambient: string;    // ambient light / rack frame accent
  rackBody: string;   // rack body color
  rackTrim: string;   // rack trim / primary border
  ledIdle: string;    // LED idle/other state (yellow)
  ledActive: string;  // LED running state (green)
  ledError: string;   // LED stopped/error state (red)
  cableA: string;     // accent border / primary cable
  cableB: string;     // secondary text / secondary cable
  screenBg: string;   // detail card background
  screenText: string; // primary text (labels, names)
  accentA: string;    // accent text A (highlights)
  accentB: string;    // accent text B (secondary highlights)
  shadow: string;     // shadow color
}

export interface ScenePalettePreset {
  name: string;
  palette: ScenePalette;
}

// ─── Built-in presets ─────────────────────────────────────────────────────────

export const scenePalettePresets: readonly ScenePalettePreset[] = [
  {
    name: 'Classic',
    palette: {
      floor: '#0a0e1a',
      wall: '#040812',
      ceiling: '#060a1b',
      ambient: '#235a88',
      rackBody: '#235a88',
      rackTrim: '#354768',
      ledIdle: '#facc15',
      ledActive: '#4ade80',
      ledError: '#ef4444',
      cableA: 'rgba(127, 198, 255, 0.85)',
      cableB: '#9fd1ef',
      screenBg: 'rgba(7, 10, 24, 0.86)',
      screenText: '#ecf8ff',
      accentA: '#f2f7ff',
      accentB: '#bdd0ec',
      shadow: '#000000',
    },
  },
  {
    name: 'Amber Terminal',
    palette: {
      floor: '#0d0800',
      wall: '#1a1000',
      ceiling: '#120900',
      ambient: '#7a4800',
      rackBody: '#7a4800',
      rackTrim: '#5c3a00',
      ledIdle: '#ffd060',
      ledActive: '#ffb000',
      ledError: '#ff4400',
      cableA: 'rgba(255, 176, 0, 0.85)',
      cableB: '#c8820a',
      screenBg: 'rgba(20, 10, 0, 0.86)',
      screenText: '#ffc840',
      accentA: '#ffe880',
      accentB: '#e8a020',
      shadow: '#000000',
    },
  },
  {
    name: 'Matrix',
    palette: {
      floor: '#000d00',
      wall: '#001400',
      ceiling: '#000800',
      ambient: '#003300',
      rackBody: '#003300',
      rackTrim: '#002200',
      ledIdle: '#00cc00',
      ledActive: '#00ff41',
      ledError: '#ff0000',
      cableA: 'rgba(0, 255, 65, 0.85)',
      cableB: '#008f11',
      screenBg: 'rgba(0, 10, 0, 0.86)',
      screenText: '#00ff41',
      accentA: '#00ff41',
      accentB: '#00cc33',
      shadow: '#000000',
    },
  },
  {
    name: 'Ice',
    palette: {
      floor: '#000d1a',
      wall: '#00101f',
      ceiling: '#000e18',
      ambient: '#0047ab',
      rackBody: '#0047ab',
      rackTrim: '#0a4a6e',
      ledIdle: '#80ffff',
      ledActive: '#00cfff',
      ledError: '#ff4466',
      cableA: 'rgba(0, 207, 255, 0.85)',
      cableB: '#7fd4f0',
      screenBg: 'rgba(0, 12, 28, 0.86)',
      screenText: '#e0f7ff',
      accentA: '#ffffff',
      accentB: '#a0e8ff',
      shadow: '#000000',
    },
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pd_scene_palette';

function loadFromStorage(): ScenePalette {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScenePalette;
      if (parsed && typeof parsed.floor === 'string') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return scenePalettePresets[0].palette;
}

function createScenePaletteStore() {
  const initial = typeof window !== 'undefined' ? loadFromStorage() : scenePalettePresets[0].palette;
  const { subscribe, set, update } = writable<ScenePalette>(initial);

  return {
    subscribe,
    set(palette: ScenePalette) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
      } catch {
        // ignore storage errors
      }
      set(palette);
    },
    update,
  };
}

export const currentScenePalette = createScenePaletteStore();

// ─── Apply ────────────────────────────────────────────────────────────────────

export function applyScenePalette(palette: ScenePalette, el: HTMLElement): void {
  el.style.setProperty('--scene-floor', palette.floor);
  el.style.setProperty('--scene-wall', palette.wall);
  el.style.setProperty('--scene-ceiling', palette.ceiling);
  el.style.setProperty('--scene-ambient', palette.ambient);
  el.style.setProperty('--scene-rack-body', palette.rackBody);
  el.style.setProperty('--scene-rack-trim', palette.rackTrim);
  el.style.setProperty('--scene-led-idle', palette.ledIdle);
  el.style.setProperty('--scene-led-active', palette.ledActive);
  el.style.setProperty('--scene-led-error', palette.ledError);
  el.style.setProperty('--scene-cable-a', palette.cableA);
  el.style.setProperty('--scene-cable-b', palette.cableB);
  el.style.setProperty('--scene-screen-bg', palette.screenBg);
  el.style.setProperty('--scene-screen-text', palette.screenText);
  el.style.setProperty('--scene-accent-a', palette.accentA);
  el.style.setProperty('--scene-accent-b', palette.accentB);
  el.style.setProperty('--scene-shadow', palette.shadow);
}
