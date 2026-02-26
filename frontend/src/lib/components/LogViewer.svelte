<script lang="ts">
  import { addToast } from '$lib/stores/swarm';

  interface Props {
    containerId: string;
    containerName: string;
    onClose: () => void;
  }

  let { containerId, containerName, onClose }: Props = $props();

  let lines: string[] = $state([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let autoScroll = $state(true);
  let logContainer: HTMLDivElement | undefined = $state();

  const filteredLines = $derived(
    searchQuery
      ? lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
      : lines
  );

  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem('pixdock_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async function fetchLogs() {
    loading = true;
    try {
      const res = await fetch(`/api/containers/${containerId}/logs?tail=500&timestamps=true`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      lines = data.lines || [];
    } catch {
      addToast('FAILED TO FETCH LOGS', 'error');
      lines = ['Error: Could not load container logs.'];
    }
    loading = false;
    scrollToBottom();
  }

  function scrollToBottom() {
    if (autoScroll && logContainer) {
      requestAnimationFrame(() => {
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  $effect(() => {
    fetchLogs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="log-overlay" role="dialog">
  <div class="log-modal pixel-panel">
    <div class="log-header">
      <div class="log-title">
        <span class="log-icon">&#9612;</span>
        LOGS: {containerName.toUpperCase()}
      </div>
      <div class="log-controls">
        <input
          type="text"
          class="log-search"
          placeholder="FILTER..."
          bind:value={searchQuery}
        />
        <label class="auto-scroll-toggle">
          <input type="checkbox" bind:checked={autoScroll} />
          AUTO&#8595;
        </label>
        <button class="log-refresh" onclick={fetchLogs} title="Refresh">&#8635;</button>
        <button class="log-close" onclick={onClose} title="Close (ESC)">&#10005;</button>
      </div>
    </div>

    <div class="log-body" bind:this={logContainer}>
      {#if loading && lines.length === 0}
        <div class="log-loading">LOADING LOGS...</div>
      {:else if filteredLines.length === 0}
        <div class="log-empty">
          {searchQuery ? 'NO MATCHING LINES' : 'NO LOGS AVAILABLE'}
        </div>
      {:else}
        {#each filteredLines as line, i}
          <div class="log-line" class:log-line-alt={i % 2 === 0}>
            <span class="log-num">{i + 1}</span>
            <span class="log-text">{line}</span>
          </div>
        {/each}
      {/if}
    </div>

    <div class="log-footer">
      <span>{filteredLines.length} lines</span>
      {#if searchQuery}
        <span>({lines.length} total)</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .log-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .log-modal {
    width: 100%;
    max-width: 960px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-dark);
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 2px solid var(--border);
    flex-wrap: wrap;
    gap: 8px;
  }

  .log-title {
    font-size: 9px;
    color: var(--green);
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .log-icon {
    color: var(--green);
    font-size: 12px;
  }

  .log-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .log-search {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    color: var(--text);
    padding: 4px 8px;
    width: 140px;
    outline: none;
  }

  .log-search:focus {
    border-color: var(--blue);
  }

  .auto-scroll-toggle {
    font-size: 7px;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .auto-scroll-toggle input {
    accent-color: var(--green);
  }

  .log-refresh,
  .log-close {
    width: 22px;
    height: 22px;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    color: var(--text-dim);
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Press Start 2P', monospace;
  }

  .log-refresh:hover {
    border-color: var(--blue);
    color: var(--blue);
  }

  .log-close:hover {
    border-color: var(--red);
    color: var(--red);
  }

  .log-body {
    flex: 1;
    overflow-y: auto;
    font-family: monospace;
    font-size: 11px;
    line-height: 1.5;
    background: #050510;
    padding: 4px;
  }

  .log-loading,
  .log-empty {
    color: var(--text-dim);
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    text-align: center;
    padding: 32px;
  }

  .log-line {
    display: flex;
    gap: 8px;
    padding: 1px 4px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-line:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .log-line-alt {
    background: rgba(255, 255, 255, 0.01);
  }

  .log-num {
    color: var(--text-dim);
    font-size: 9px;
    min-width: 32px;
    text-align: right;
    user-select: none;
    opacity: 0.5;
  }

  .log-text {
    color: #c8d0d8;
  }

  .log-footer {
    padding-top: 8px;
    margin-top: 8px;
    border-top: 2px solid var(--border);
    font-size: 7px;
    color: var(--text-dim);
    display: flex;
    gap: 6px;
  }
</style>
