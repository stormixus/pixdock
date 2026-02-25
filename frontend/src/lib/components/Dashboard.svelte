<script lang="ts">
  import { stats, connectionStatus, dockerMode } from '$lib/stores/swarm';
  import NodeRack from './NodeRack.svelte';
  import ServiceList from './ServiceList.svelte';
  import ContainerGrid from './ContainerGrid.svelte';
  import PixelStatusBar from './PixelStatusBar.svelte';
  import Toast from './Toast.svelte';
</script>

<div class="crt">
  <div class="dashboard">
    <header class="header pixel-panel">
      <h1 class="title">
        <span class="logo-bracket">[</span>
        <span class="logo-px">PX</span>
        <span class="logo-bracket">]</span>
        PIX<span class="accent">DOCK</span>
      </h1>
      <div class="header-stats">
        <span class="stat">
          <span class="led" class:led-green={$connectionStatus === 'connected'} class:led-red={$connectionStatus === 'disconnected'} class:led-yellow={$connectionStatus === 'connecting'} class:blink={$connectionStatus === 'connecting'}></span>
          {$connectionStatus.toUpperCase()}
        </span>
        <span class="stat mode-badge">{$dockerMode.toUpperCase()}</span>

        {#if $dockerMode === 'swarm'}
          <span class="stat">NODES: {$stats.readyNodes}/{$stats.totalNodes}</span>
          <span class="stat">SVCS: {$stats.healthyServices}/{$stats.totalServices}</span>
        {/if}
        <span class="stat">
          CTR: {$stats.runningContainers}/{$stats.totalContainers}
        </span>
      </div>
    </header>

    <main class="main">
      {#if $dockerMode === 'swarm'}
        <section class="section">
          <h2 class="section-title">&#9654; SERVER RACK</h2>
          <NodeRack />
        </section>

        <section class="section">
          <h2 class="section-title">&#9654; SERVICES</h2>
          <ServiceList />
        </section>
      {/if}

      <section class="section">
        <h2 class="section-title">&#9654; CONTAINERS</h2>
        <ContainerGrid />
      </section>
    </main>

    <PixelStatusBar />
  </div>

  <div class="scanlines"></div>
</div>

<Toast />

<style>
  .crt {
    position: relative;
    min-height: 100vh;
  }

  .scanlines {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 50;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.08) 2px,
      rgba(0, 0, 0, 0.08) 4px
    );
  }

  .dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px;
  }

  .title {
    font-size: 14px;
    letter-spacing: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .logo-bracket {
    color: var(--text-dim);
    font-size: 16px;
  }

  .logo-px {
    color: var(--blue);
    font-size: 12px;
  }

  .accent {
    color: var(--green);
  }

  .header-stats {
    display: flex;
    gap: 24px;
    align-items: center;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 8px;
    color: var(--text-dim);
  }

  .mode-badge {
    color: var(--yellow);
    border: 1px solid var(--yellow);
    padding: 2px 6px;
    font-size: 7px;
    letter-spacing: 1px;
  }

  .main {
    flex: 1;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 10px;
    color: var(--blue);
    margin-bottom: 12px;
    letter-spacing: 2px;
  }
</style>
