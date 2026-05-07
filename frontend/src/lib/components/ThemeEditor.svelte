<script lang="ts">
  import {
    currentScenePalette,
    scenePalettePresets,
    applyScenePalette,
  } from '$lib/stores/scenePalette';
  import type { ScenePalette, ScenePalettePreset } from '$lib/stores/scenePalette';
  import { UI_STRINGS } from '$lib/constants/strings';

  // Local editable copy — initialised once from the store.
  // All writes go through our handlers which push back to the store.
  let editPalette = $state<ScenePalette>({ ...$currentScenePalette });
  let activePresetName = $state<string>(
    scenePalettePresets.find((p) => JSON.stringify(p.palette) === JSON.stringify($currentScenePalette))?.name ?? ''
  );

  // ── colour-field metadata (16 fields, matching ScenePalette exactly) ─────────
  const COLOR_FIELDS: { key: keyof ScenePalette; label: string }[] = [
    { key: 'floor',      label: UI_STRINGS.COLOR_FLOOR },
    { key: 'wall',       label: UI_STRINGS.COLOR_WALL },
    { key: 'ceiling',    label: UI_STRINGS.COLOR_CEILING },
    { key: 'ambient',    label: UI_STRINGS.COLOR_AMBIENT },
    { key: 'rackBody',   label: UI_STRINGS.COLOR_RACK_BODY },
    { key: 'rackTrim',   label: UI_STRINGS.COLOR_RACK_TRIM },
    { key: 'ledIdle',    label: UI_STRINGS.COLOR_LED_IDLE },
    { key: 'ledActive',  label: UI_STRINGS.COLOR_LED_ACTIVE },
    { key: 'ledError',   label: UI_STRINGS.COLOR_LED_ERROR },
    { key: 'cableA',     label: UI_STRINGS.COLOR_CABLE_A },
    { key: 'cableB',     label: UI_STRINGS.COLOR_CABLE_B },
    { key: 'screenBg',   label: UI_STRINGS.COLOR_SCREEN_BG },
    { key: 'screenText', label: UI_STRINGS.COLOR_SCREEN_TEXT },
    { key: 'accentA',    label: UI_STRINGS.COLOR_ACCENT_A },
    { key: 'accentB',    label: UI_STRINGS.COLOR_ACCENT_B },
    { key: 'shadow',     label: UI_STRINGS.COLOR_SHADOW },
  ];

  // ── helpers ──────────────────────────────────────────────────────────────────
  /** Normalise any CSS colour to #rrggbb for <input type="color">. */
  function toHex(color: string): string {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
    const m = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return (
        '#' +
        [m[1], m[2], m[3]]
          .map((n) => parseInt(n).toString(16).padStart(2, '0'))
          .join('')
      );
    }
    return '#000000';
  }

  /** Push palette to the store and apply CSS vars to the scene canvas. */
  function push(palette: ScenePalette) {
    currentScenePalette.set(palette);
    const canvas = typeof document !== 'undefined'
      ? (document.querySelector('.scene-canvas') as HTMLElement | null)
      : null;
    if (canvas) applyScenePalette(palette, canvas);
  }

  function selectPreset(preset: ScenePalettePreset) {
    editPalette = { ...preset.palette };
    activePresetName = preset.name;
    push({ ...preset.palette });
  }

  function updateColor(field: keyof ScenePalette, hex: string) {
    (editPalette as Record<string, string>)[field] = hex;
    push({ ...editPalette });
  }

  function resetToPreset() {
    const found = scenePalettePresets.find((p) => p.name === activePresetName);
    if (found) selectPreset(found);
  }

  function saveCustom() {
    // Persist current edits explicitly (already live-saved, this confirms intent)
    push({ ...editPalette });
  }
</script>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<div style="margin-bottom: 10px;">
  <span style="display: block; font-size: 12px; color: var(--text); font-weight: bold;">
    {UI_STRINGS.SCENE_COLORS_LABEL}
  </span>
  <span style="display: block; font-size: 10px; color: var(--text-dim); margin-top: 2px;">
    {UI_STRINGS.SCENE_COLORS_SUBTITLE}
  </span>
</div>

<!-- ── Preset selector ────────────────────────────────────────────────────── -->
<div style="margin-bottom: 10px;">
  <span style="display: block; font-size: 10px; color: var(--text-dim); margin-bottom: 6px;">
    {UI_STRINGS.PRESET_LABEL}
  </span>
  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
    {#each scenePalettePresets as preset}
      <button
        onclick={() => selectPreset(preset)}
        style="
          padding: 4px 8px;
          font-size: 10px;
          font-family: inherit;
          cursor: pointer;
          border: 1px solid var(--border);
          background: {activePresetName === preset.name ? 'var(--blue)' : 'var(--bg-dark)'};
          color: {activePresetName === preset.name ? 'var(--bg-dark)' : 'var(--text)'};
          transition: background 0.15s, color 0.15s;
        "
      >
        {preset.name}
      </button>
    {/each}
  </div>
</div>

<!-- ── Colour grid ─────────────────────────────────────────────────────────── -->
<div
  style="
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 8px;
    margin-bottom: 10px;
  "
>
  {#each COLOR_FIELDS as { key, label }}
    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
      <input
        type="color"
        value={toHex(editPalette[key])}
        oninput={(e) => updateColor(key, e.currentTarget.value)}
        style="
          width: 22px;
          height: 22px;
          padding: 0;
          border: 1px solid var(--border);
          background: none;
          cursor: pointer;
          flex-shrink: 0;
        "
      />
      <span style="font-size: 9px; color: var(--text-dim); line-height: 1.2;">{label}</span>
    </label>
  {/each}
</div>

<!-- ── Action buttons ─────────────────────────────────────────────────────── -->
<div style="display: flex; gap: 6px;">
  <button
    onclick={resetToPreset}
    style="
      flex: 1;
      padding: 5px 0;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      color: var(--text-dim);
    "
  >
    {UI_STRINGS.RESET_PRESET_LABEL}
  </button>
  <button
    onclick={saveCustom}
    style="
      flex: 1;
      padding: 5px 0;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      background: var(--bg-dark);
      border: 1px solid var(--blue);
      color: var(--blue);
    "
  >
    {UI_STRINGS.SAVE_CUSTOM_LABEL}
  </button>
</div>
