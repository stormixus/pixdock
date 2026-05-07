<script lang="ts">
  import { exportScenePNG, isExporting } from '$lib/utils/export';
  import { UI_STRINGS } from '$lib/constants/strings';
</script>

<div class="export-bar">
  <button
    class="export-btn pixel-btn"
    disabled={$isExporting}
    onclick={exportScenePNG}
    aria-label={UI_STRINGS.EXPORT_LABEL}
  >
    {#if $isExporting}
      <span class="spinner" aria-hidden="true"></span>
      {UI_STRINGS.EXPORT_BUTTON_LOADING}
    {:else}
      <span class="icon" aria-hidden="true">📷</span>
      {UI_STRINGS.EXPORT_LABEL}
    {/if}
  </button>
</div>

<style>
  .export-bar {
    display: flex;
    justify-content: flex-end;
    padding: 0 2px;
  }

  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-family: inherit;
    font-size: 8px;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    color: var(--text, #e4edff);
    background: var(--bg-panel, rgba(10, 16, 38, 0.9));
    border: 2px solid var(--border, #354768);
    transition: border-color 0.15s, background 0.15s, opacity 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    border-color: #61dbff;
    background: rgba(20, 38, 70, 0.95);
  }

  .export-btn:active:not(:disabled) {
    background: rgba(30, 55, 95, 0.95);
  }

  .export-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .icon {
    font-size: 10px;
    line-height: 1;
  }

  .spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 2px solid rgba(97, 219, 255, 0.3);
    border-top-color: #61dbff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
