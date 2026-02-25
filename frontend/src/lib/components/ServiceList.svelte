<script lang="ts">
  import { stacks, nodes, addToast } from '$lib/stores/swarm';
  import { fetchTasks, scaleService, type SwarmTask, type SwarmService } from '$lib/utils/ws';

  let expandedService: string | null = $state(null);
  let tasks: SwarmTask[] = $state([]);
  let loadingTasks = $state(false);
  let scaling = $state(false);

  function isHealthy(running: number, desired: number): boolean {
    return running >= desired;
  }

  function shortImage(image: string): string {
    const parts = image.split('/');
    return parts.length > 2 ? parts.slice(-2).join('/') : image;
  }

  function getNodeName(nodeId: string): string {
    const node = $nodes.find((n) => n.id === nodeId);
    return node?.hostname ?? nodeId.slice(0, 12);
  }

  function taskStatusLed(status: string): string {
    switch (status) {
      case 'running': return 'led-green';
      case 'failed': case 'rejected': return 'led-red';
      default: return 'led-yellow';
    }
  }

  async function toggleExpand(svc: SwarmService) {
    if (expandedService === svc.id) {
      expandedService = null;
      tasks = [];
      return;
    }
    expandedService = svc.id;
    loadingTasks = true;
    try {
      tasks = await fetchTasks(svc.id);
    } catch {
      tasks = [];
      addToast('FAILED TO LOAD TASKS', 'error');
    }
    loadingTasks = false;
  }

  async function handleScale(svc: SwarmService, delta: number) {
    const newReplicas = Math.max(0, svc.replicas_desired + delta);
    scaling = true;
    try {
      await scaleService(svc.id, newReplicas);
      addToast(`SCALED ${svc.name.split('_').pop()?.toUpperCase()} -> ${newReplicas}`, 'success');
    } catch {
      addToast('SCALE FAILED', 'error');
    }
    scaling = false;
  }
</script>

<div class="stacks">
  {#each [...$stacks.entries()] as [stackName, services]}
    <div class="stack-group pixel-panel">
      <div class="stack-header">
        <span class="stack-name">{stackName === '_standalone' ? 'STANDALONE' : stackName.toUpperCase()}</span>
        <span class="stack-count">{services.length} svc</span>
      </div>

      <div class="service-table">
        {#each services as svc}
          <button
            class="service-row"
            class:service-unhealthy={!isHealthy(svc.replicas_running, svc.replicas_desired)}
            class:service-expanded={expandedService === svc.id}
            onclick={() => toggleExpand(svc)}
          >
            <div class="svc-status">
              <span
                class="led"
                class:led-green={isHealthy(svc.replicas_running, svc.replicas_desired)}
                class:led-red={!isHealthy(svc.replicas_running, svc.replicas_desired)}
                class:blink={!isHealthy(svc.replicas_running, svc.replicas_desired)}
              ></span>
            </div>

            <div class="svc-name">{svc.name.replace(stackName + '_', '')}</div>

            <div class="svc-replicas">
              <span class="gauge-bar" style="width: 48px;">
                <span
                  class="gauge-fill"
                  class:healthy={isHealthy(svc.replicas_running, svc.replicas_desired)}
                  class:critical={!isHealthy(svc.replicas_running, svc.replicas_desired)}
                  style="width: {svc.replicas_desired > 0 ? (svc.replicas_running / svc.replicas_desired) * 100 : 0}%"
                ></span>
              </span>
              <span class="replica-text">{svc.replicas_running}/{svc.replicas_desired}</span>
            </div>

            <div class="svc-image">{shortImage(svc.image)}</div>

            <div class="svc-ports">
              {#each svc.ports as port}
                <span class="port-badge">:{port.published}</span>
              {/each}
            </div>
          </button>

          <!-- Expanded detail panel -->
          {#if expandedService === svc.id}
            <div class="detail-panel">
              <div class="detail-header">
                <div class="detail-info">
                  <span class="detail-label">IMAGE</span>
                  <span class="detail-value">{svc.image}</span>
                </div>
                <div class="scale-controls">
                  <button
                    class="scale-btn"
                    disabled={scaling || svc.replicas_desired <= 0}
                    onclick={(e) => { e.stopPropagation(); handleScale(svc, -1); }}
                  >-</button>
                  <span class="scale-count">{svc.replicas_desired}</span>
                  <button
                    class="scale-btn"
                    disabled={scaling}
                    onclick={(e) => { e.stopPropagation(); handleScale(svc, 1); }}
                  >+</button>
                </div>
              </div>

              <!-- Task list -->
              <div class="task-list">
                <div class="task-header-row">
                  <span>SLOT</span>
                  <span>STATUS</span>
                  <span>NODE</span>
                  <span>ID</span>
                </div>
                {#if loadingTasks}
                  <div class="task-loading blink">LOADING...</div>
                {:else if tasks.length === 0}
                  <div class="task-loading">NO TASKS</div>
                {:else}
                  {#each tasks.filter((t) => t.desired_state === 'running' || t.status === 'running') as task}
                    <div class="task-row">
                      <span class="task-slot">#{task.slot}</span>
                      <span class="task-status">
                        <span class="led {taskStatusLed(task.status)}"></span>
                        {task.status.toUpperCase()}
                      </span>
                      <span class="task-node">{getNodeName(task.node_id)}</span>
                      <span class="task-id">{task.id}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .stacks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stack-group {
    padding: 12px;
  }

  .stack-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }

  .stack-name {
    font-size: 9px;
    color: var(--purple);
    letter-spacing: 1px;
  }

  .stack-count {
    margin-left: auto;
    font-size: 7px;
    color: var(--text-dim);
  }

  .service-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .service-row {
    display: grid;
    grid-template-columns: 16px 1fr 100px 1.5fr auto;
    align-items: center;
    gap: 12px;
    padding: 4px 8px;
    font-size: 8px;
    font-family: 'Press Start 2P', monospace;
    background: var(--bg-dark);
    border: 1px solid transparent;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .service-row:hover {
    border-color: var(--border);
  }

  .service-expanded {
    border-color: var(--blue) !important;
    background: var(--bg-panel-light);
  }

  .service-unhealthy {
    background: var(--red-dark);
  }

  .svc-name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .svc-replicas {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .replica-text {
    font-size: 7px;
    color: var(--text-dim);
    min-width: 30px;
  }

  .svc-image {
    color: var(--text-dim);
    font-size: 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .svc-ports {
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

  /* Detail panel */
  .detail-panel {
    background: var(--bg-panel-light);
    border: 1px solid var(--blue);
    border-top: none;
    padding: 10px 12px;
    font-size: 7px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .detail-label {
    color: var(--text-dim);
    margin-right: 6px;
  }

  .detail-value {
    color: var(--text);
    font-size: 7px;
  }

  .scale-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .scale-btn {
    width: 20px;
    height: 20px;
    background: var(--bg-dark);
    border: 2px solid var(--border);
    color: var(--text);
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .scale-btn:hover:not(:disabled) {
    border-color: var(--green);
    color: var(--green);
  }

  .scale-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .scale-count {
    font-size: 10px;
    color: var(--green);
    min-width: 20px;
    text-align: center;
  }

  /* Task list */
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .task-header-row {
    display: grid;
    grid-template-columns: 40px 80px 1fr 100px;
    gap: 8px;
    color: var(--text-dim);
    font-size: 6px;
    padding: 2px 4px;
    letter-spacing: 1px;
  }

  .task-row {
    display: grid;
    grid-template-columns: 40px 80px 1fr 100px;
    gap: 8px;
    padding: 3px 4px;
    background: var(--bg-dark);
    align-items: center;
  }

  .task-status {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .task-slot { color: var(--yellow); }
  .task-node { color: var(--text); }
  .task-id { color: var(--text-dim); }

  .task-loading {
    text-align: center;
    padding: 8px;
    color: var(--text-dim);
    font-size: 7px;
  }
</style>
