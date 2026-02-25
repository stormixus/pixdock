<script lang="ts">
  import { dashboardState, connectionStatus, dockerMode } from '$lib/stores/swarm';
  import { derived } from 'svelte/store';

  const timestamp = derived(dashboardState, ($s) =>
    $s.timestamp ? new Date($s.timestamp).toLocaleTimeString() : '--:--:--'
  );
</script>

<footer class="status-bar">
  <span class="bar-item">PIXDOCK v0.2.0</span>
  <span class="bar-item">MODE: {$dockerMode.toUpperCase()}</span>
  <span class="bar-item">LAST UPDATE: {$timestamp}</span>
  <span class="bar-item">WS: {$connectionStatus.toUpperCase()}</span>
</footer>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--bg-panel);
    border-top: var(--pixel-size) solid var(--border);
    font-size: 7px;
    color: var(--text-dim);
  }

  .bar-item {
    letter-spacing: 1px;
  }
</style>
