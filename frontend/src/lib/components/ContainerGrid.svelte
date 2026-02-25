<script lang="ts">
  import { projects, addToast } from '$lib/stores/swarm';
  import { containerAction } from '$lib/utils/ws';

  let actionLoading: string | null = $state(null);

  function stateColor(state: string): string {
    switch (state) {
      case 'running': return 'led-green';
      case 'exited': case 'dead': return 'led-red';
      case 'paused': return 'led-yellow';
      case 'restarting': return 'led-yellow';
      default: return 'led-yellow';
    }
  }

  function stateTextClass(state: string): string {
    switch (state) {
      case 'running': return 'status-ready';
      case 'exited': case 'dead': return 'status-down';
      default: return 'status-disconnected';
    }
  }

  function shortImage(image: string): string {
    // Remove sha256 digest
    const clean = image.split('@')[0];
    const parts = clean.split('/');
    return parts.length > 2 ? parts.slice(-2).join('/') : clean;
  }

  async function handleAction(containerId: string, action: 'start' | 'stop' | 'restart') {
    actionLoading = containerId;
    try {
      await containerAction(containerId, action);
      addToast(`${action.toUpperCase()} OK`, 'success');
    } catch {
      addToast(`${action.toUpperCase()} FAILED`, 'error');
    }
    actionLoading = null;
  }
</script>

<div class="projects">
  {#each [...$projects.entries()] as [projectName, ctrs]}
    <div class="project-group pixel-panel">
      <div class="project-header">
        <span class="project-name">
          {projectName === '_standalone' ? 'CONTAINERS' : projectName.toUpperCase()}
        </span>
        <span class="project-count">
          {ctrs.filter((c) => c.state === 'running').length}/{ctrs.length} running
        </span>
      </div>

      <div class="container-table">
        {#each ctrs as ctr}
          <div class="container-row" class:container-stopped={ctr.state !== 'running'}>
            <div class="ctr-status">
              <span
                class="led {stateColor(ctr.state)}"
                class:blink={ctr.state === 'restarting'}
              ></span>
            </div>

            <div class="ctr-name">{ctr.name}</div>

            <div class="ctr-state {stateTextClass(ctr.state)}">
              {ctr.state.toUpperCase()}
            </div>

            <div class="ctr-image">{shortImage(ctr.image)}</div>

            <div class="ctr-ports">
              {#each ctr.ports.filter((p) => p.public_port) as port}
                <span class="port-badge">:{port.public_port}</span>
              {/each}
            </div>

            <div class="ctr-actions">
              {#if ctr.state === 'running'}
                <button
                  class="action-btn action-stop"
                  disabled={actionLoading === ctr.id}
                  onclick={() => handleAction(ctr.id, 'stop')}
                  title="Stop"
                >&#9632;</button>
                <button
                  class="action-btn action-restart"
                  disabled={actionLoading === ctr.id}
                  onclick={() => handleAction(ctr.id, 'restart')}
                  title="Restart"
                >&#8635;</button>
              {:else}
                <button
                  class="action-btn action-start"
                  disabled={actionLoading === ctr.id}
                  onclick={() => handleAction(ctr.id, 'start')}
                  title="Start"
                >&#9654;</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .projects {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .project-group {
    padding: 12px;
  }

  .project-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }

  .project-name {
    font-size: 9px;
    color: var(--purple);
    letter-spacing: 1px;
  }

  .project-count {
    margin-left: auto;
    font-size: 7px;
    color: var(--text-dim);
  }

  .container-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .container-row {
    display: grid;
    grid-template-columns: 16px 1.2fr 70px 1.5fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 5px 8px;
    font-size: 8px;
    background: var(--bg-dark);
    border: 1px solid transparent;
  }

  .container-row:hover {
    border-color: var(--border);
  }

  .container-stopped {
    opacity: 0.6;
  }

  .ctr-name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctr-state {
    font-size: 7px;
    letter-spacing: 1px;
  }

  .ctr-image {
    color: var(--text-dim);
    font-size: 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctr-ports {
    display: flex;
    gap: 4px;
  }

  .port-badge {
    font-size: 7px;
    color: var(--blue);
    background: rgba(96, 165, 250, 0.1);
    padding: 1px 4px;
    border: 1px solid var(--blue);
  }

  .ctr-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    width: 18px;
    height: 18px;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    color: var(--text-dim);
    font-size: 9px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: 'Press Start 2P', monospace;
    line-height: 1;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--text);
    color: var(--text);
  }

  .action-stop:hover:not(:disabled) {
    border-color: var(--red);
    color: var(--red);
  }

  .action-start:hover:not(:disabled) {
    border-color: var(--green);
    color: var(--green);
  }

  .action-restart:hover:not(:disabled) {
    border-color: var(--yellow);
    color: var(--yellow);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
