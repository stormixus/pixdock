import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenePalette {
  name: string;
  bgDark: string;        // scene background dark
  bgLight: string;       // scene background light
  rackFrame: string;     // rack border/frame
  rackBg: string;        // rack background
  ledRunning: string;    // LED green (running)
  ledStopped: string;    // LED red (stopped)
  ledOther: string;      // LED yellow (other states)
  textPrimary: string;   // primary text (labels, names)
  textSecondary: string; // secondary text (counts, dims)
  textAccent: string;    // accent text (highlights)
  borderPrimary: string; // primary borders
  borderAccent: string;  // accent borders (zone tags)
  cardBg: string;        // detail card background
  glowGreen: string;     // glow-pulse color
  glowRed: string;       // error-flash color
  glowYellow: string;    // restart-pulse color
}

// ─── Built-in presets ─────────────────────────────────────────────────────────

export const scenePalettePresets: readonly ScenePalette[] = [
  {
    name: 'Classic',
    bgDark: '#0a0e1a',
    bgLight: '#040812',
    rackFrame: '#235a88',
    rackBg: 'rgba(12, 19, 38, 0.92)',
    ledRunning: '#4ade80',
    ledStopped: '#ef4444',
    ledOther: '#facc15',
    textPrimary: '#ecf8ff',
    textSecondary: '#9fd1ef',
    textAccent: '#f2f7ff',
    borderPrimary: '#354768',
    borderAccent: 'rgba(127, 198, 255, 0.85)',
    cardBg: 'rgba(7, 10, 24, 0.86)',
    glowGreen: '#4ade80',
    glowRed: '#ef4444',
    glowYellow: '#fbbf24',
  },
  {
    name: 'Amber Terminal',
    bgDark: '#0d0800',
    bgLight: '#1a1000',
    rackFrame: '#7a4800',
    rackBg: 'rgba(30, 16, 0, 0.92)',
    ledRunning: '#ffb000',
    ledStopped: '#ff4400',
    ledOther: '#ffd060',
    textPrimary: '#ffc840',
    textSecondary: '#c8820a',
    textAccent: '#ffe880',
    borderPrimary: '#5c3a00',
    borderAccent: 'rgba(255, 176, 0, 0.85)',
    cardBg: 'rgba(20, 10, 0, 0.86)',
    glowGreen: '#ffb000',
    glowRed: '#ff4400',
    glowYellow: '#ffd060',
  },
  {
    name: 'Matrix',
    bgDark: '#000d00',
    bgLight: '#001400',
    rackFrame: '#003300',
    rackBg: 'rgba(0, 12, 0, 0.92)',
    ledRunning: '#00ff41',
    ledStopped: '#ff0000',
    ledOther: '#00cc00',
    textPrimary: '#00ff41',
    textSecondary: '#008f11',
    textAccent: '#00ff41',
    borderPrimary: '#003300',
    borderAccent: 'rgba(0, 255, 65, 0.85)',
    cardBg: 'rgba(0, 10, 0, 0.86)',
    glowGreen: '#00ff41',
    glowRed: '#ff0000',
    glowYellow: '#00cc00',
  },
  {
    name: 'Ice',
    bgDark: '#000d1a',
    bgLight: '#00101f',
    rackFrame: '#0047ab',
    rackBg: 'rgba(0, 20, 40, 0.92)',
    ledRunning: '#00cfff',
    ledStopped: '#ff4466',
    ledOther: '#80ffff',
    textPrimary: '#e0f7ff',
    textSecondary: '#7fd4f0',
    textAccent: '#ffffff',
    borderPrimary: '#0a4a6e',
    borderAccent: 'rgba(0, 207, 255, 0.85)',
    cardBg: 'rgba(0, 12, 28, 0.86)',
    glowGreen: '#00cfff',
    glowRed: '#ff4466',
    glowYellow: '#80ffff',
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pd_scene_palette';

function loadFromStorage(): ScenePalette {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScenePalette;
      if (parsed && typeof parsed.bgDark === 'string') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return scenePalettePresets[0];
}

function createScenePaletteStore() {
  const initial = typeof window !== 'undefined' ? loadFromStorage() : scenePalettePresets[0];
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

export function applyScenePalette(palette: ScenePalette): void {
  const el = document.querySelector('.scene-canvas') as HTMLElement | null;
  if (!el) return;

  el.style.setProperty('--scene-bg-dark', palette.bgDark);
  el.style.setProperty('--scene-bg-light', palette.bgLight);
  el.style.setProperty('--scene-rack-frame', palette.rackFrame);
  el.style.setProperty('--scene-rack-bg', palette.rackBg);
  el.style.setProperty('--scene-led-running', palette.ledRunning);
  el.style.setProperty('--scene-led-stopped', palette.ledStopped);
  el.style.setProperty('--scene-led-other', palette.ledOther);
  el.style.setProperty('--scene-text-primary', palette.textPrimary);
  el.style.setProperty('--scene-text-secondary', palette.textSecondary);
  el.style.setProperty('--scene-text-accent', palette.textAccent);
  el.style.setProperty('--scene-border-primary', palette.borderPrimary);
  el.style.setProperty('--scene-border-accent', palette.borderAccent);
  el.style.setProperty('--scene-card-bg', palette.cardBg);
  el.style.setProperty('--scene-glow-green', palette.glowGreen);
  el.style.setProperty('--scene-glow-red', palette.glowRed);
  el.style.setProperty('--scene-glow-yellow', palette.glowYellow);
}
