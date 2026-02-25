<script lang="ts">
  import { nodes } from '$lib/stores/swarm';

  function formatMemory(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)}G`;
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case 'ready': return 'status-ready';
      case 'down': return 'status-down';
      default: return 'status-disconnected';
    }
  }

  function getLedClass(status: string): string {
    switch (status) {
      case 'ready': return 'led-green';
      case 'down': return 'led-red';
      default: return 'led-yellow';
    }
  }
</script>

<div class="rack-grid">
  {#each $nodes as node}
    <div class="node-unit pixel-panel" class:node-down={node.status !== 'ready'} class:node-drain={node.availability === 'drain'}>
      <!-- Server front panel -->
      <div class="node-face">
        <div class="led-row">
          <span class="led {getLedClass(node.status)}" class:blink={node.status !== 'ready'}></span>
          <span class="led {getLedClass(node.status)}"></span>
          <span class="node-role" class:role-manager={node.role === 'manager'}>
            {node.role === 'manager' ? '★' : '●'}
          </span>
        </div>

        <div class="node-hostname">{node.hostname}</div>
        <div class="node-ip">{node.ip}</div>
      </div>

      <!-- Specs bar -->
      <div class="node-specs">
        <div class="spec-row">
          <span class="spec-label">CPU</span>
          <span class="spec-value">{node.cpus}c</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">MEM</span>
          <span class="spec-value">{formatMemory(node.memory_bytes)}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">ARCH</span>
          <span class="spec-value">{node.arch}</span>
        </div>
      </div>

      <!-- Status footer -->
      <div class="node-footer {getStatusClass(node.status)}">
        {node.status.toUpperCase()}
        {#if node.availability !== 'active'}
          / {node.availability.toUpperCase()}
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .rack-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }

  .node-unit {
    padding: 12px;
    transition: all 0.3s steps(3);
  }

  .node-unit:hover {
    border-color: var(--green);
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.3);
  }

  .node-down {
    opacity: 0.6;
    border-color: var(--red-dark);
  }

  .node-drain {
    border-color: var(--yellow);
  }

  .node-face {
    margin-bottom: 8px;
  }

  .led-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 8px;
  }

  .node-role {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }

  .role-manager {
    color: var(--yellow);
  }

  .node-hostname {
    font-size: 10px;
    color: var(--text);
    margin-bottom: 2px;
  }

  .node-ip {
    font-size: 7px;
    color: var(--text-dim);
  }

  .node-specs {
    border-top: 2px solid var(--border);
    padding-top: 8px;
    margin-bottom: 8px;
  }

  .spec-row {
    display: flex;
    justify-content: space-between;
    font-size: 7px;
    margin-bottom: 2px;
  }

  .spec-label {
    color: var(--text-dim);
  }

  .spec-value {
    color: var(--text);
  }

  .node-footer {
    font-size: 7px;
    text-align: center;
    padding-top: 4px;
    border-top: 2px solid var(--border);
  }
</style>
