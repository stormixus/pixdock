<script lang="ts">
  import { currentTheme, crtEnabled, crtIntensity } from '$lib/stores/theme';
  import Faithful from './variations/Faithful.svelte';
  import CommandCenter from './variations/CommandCenter.svelte';
  import Arcade from './variations/Arcade.svelte';
  import Mainframe from './variations/Mainframe.svelte';
  import GameBoy from './variations/GameBoy.svelte';

  let settingsOpen = $state(false);

  const THEMES = [
    { id: 'faithful', name: 'Faithful' },
    { id: 'command', name: 'Command Center' },
    { id: 'arcade', name: 'Arcade Cabinet' },
    { id: 'mainframe', name: 'Mainframe Terminal' },
    { id: 'gameboy', name: 'Game Boy Mono' }
  ] as const;

  function toggleSettings() {
    settingsOpen = !settingsOpen;
  }

  $effect(() => {
    document.documentElement.style.setProperty('--crt-display', $crtEnabled ? 'block' : 'none');
  });
</script>

<div style="height: 100vh; width: 100vw; overflow: hidden; position: relative;">
  <!-- Render the selected variation -->
  {#if $currentTheme === 'faithful'}
    <Faithful />
  {:else if $currentTheme === 'command'}
    <CommandCenter />
  {:else if $currentTheme === 'arcade'}
    <Arcade />
  {:else if $currentTheme === 'mainframe'}
    <Mainframe />
  {:else if $currentTheme === 'gameboy'}
    <GameBoy />
  {/if}

  <!-- Settings FAB -->
  <button
    onclick={toggleSettings}
    style="position: fixed; bottom: 16px; right: 16px; width: 48px; height: 48px; border-radius: 24px; background: var(--bg-panel); border: 2px solid var(--border); color: var(--text); z-index: 9999; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 20px; display: flex; align-items: center; justify-content: center;"
    title="Display Settings"
  >
    ⚙
  </button>

  <!-- Settings Panel -->
  {#if settingsOpen}
    <div style="position: fixed; bottom: 80px; right: 16px; width: 280px; background: var(--bg-panel); border: 4px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.8); z-index: 9999; padding: 16px; font-family: 'JetBrains Mono', monospace;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">
        <h3 style="margin: 0; font-size: 14px; color: var(--text);">Display Settings</h3>
        <button onclick={toggleSettings} style="background: transparent; border: none; color: var(--text-dim); cursor: pointer;">✕</button>
      </div>

      <div style="margin-bottom: 16px;">
        <span style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">THEME VARIATION</span>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          {#each THEMES as t}
            <button
              onclick={() => currentTheme.set(t.id)}
              style="text-align: left; padding: 8px 12px; background: {$currentTheme === t.id ? 'var(--blue)' : 'var(--bg-dark)'}; color: {$currentTheme === t.id ? 'var(--bg-dark)' : 'var(--text)'}; border: 1px solid var(--border); cursor: pointer; font-size: 11px; transition: all 0.2s;"
            >
              {t.name}
            </button>
          {/each}
        </div>
      </div>

      <div>
        <span style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">CRT FX</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="checkbox"
            checked={$crtEnabled}
            onchange={(e) => crtEnabled.set(e.currentTarget.checked)}
            style="accent-color: var(--blue);"
          />
          <span style="font-size: 11px; color: var(--text);">Enabled</span>
        </div>
        
        {#if $crtEnabled}
          <div style="margin-top: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-dim); margin-bottom: 4px;">
              <span>Intensity</span>
              <span>{$crtIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={$crtIntensity}
              oninput={(e) => crtIntensity.set(parseFloat(e.currentTarget.value))}
              style="width: 100%; accent-color: var(--blue);"
            />
          </div>
        {/if}
      </div>

      <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid var(--border);">
        <span style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">DATA SOURCE</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="checkbox"
            checked={typeof window !== 'undefined' && localStorage.getItem('pd_mock_mode') === 'true'}
            onchange={(e) => {
              localStorage.setItem('pd_mock_mode', String(e.currentTarget.checked));
              window.location.reload();
            }}
            style="accent-color: var(--yellow);"
          />
          <span style="font-size: 11px; color: var(--yellow);">Virtual Fleet (Mock Data)</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Global CRT conditional overrides */
  :global(.pd-crt::before),
  :global(.pd-crt::after) {
    display: var(--crt-display, block);
  }
</style>
