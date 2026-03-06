<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { containers, dockerMode, nodes, services } from '$lib/stores/swarm';
  import type { Container } from '$lib/utils/ws';
  import type { SwarmNode, SwarmService } from '$lib/utils/ws';

  // ─── DEMO DATA (shown when no Docker connection / empty) ───
  const DEMO_CONTAINERS: Container[] = [
    { id: 'd1', name: 'webstack-nginx-1', image: 'nginx:alpine', state: 'running', status: 'Up 2 days', created: 0, ports: [{ private_port: 80, public_port: 8080, port_type: 'tcp' }], project: 'webstack' },
    { id: 'd2', name: 'webstack-app-1', image: 'node:20-alpine', state: 'running', status: 'Up 2 days', created: 0, ports: [{ private_port: 3000, public_port: 3000, port_type: 'tcp' }], project: 'webstack' },
    { id: 'd3', name: 'webstack-db-1', image: 'postgres:16', state: 'running', status: 'Up 2 days', created: 0, ports: [], project: 'webstack' },
    { id: 'd4', name: 'api-gateway-kong-1', image: 'kong:3.4', state: 'running', status: 'Up 1 day', created: 0, ports: [{ private_port: 8000, public_port: 8000, port_type: 'tcp' }], project: 'api-gateway' },
    { id: 'd5', name: 'api-gateway-kong-2', image: 'kong:3.4', state: 'running', status: 'Up 1 day', created: 0, ports: [], project: 'api-gateway' },
    { id: 'd6', name: 'api-gateway-redis-1', image: 'redis:7-alpine', state: 'running', status: 'Up 1 day', created: 0, ports: [], project: 'api-gateway' },
    { id: 'd7', name: 'monitoring-prometheus-1', image: 'prom/prometheus:latest', state: 'running', status: 'Up 5 hours', created: 0, ports: [{ private_port: 9090, public_port: 9090, port_type: 'tcp' }], project: 'monitoring' },
    { id: 'd8', name: 'monitoring-grafana-1', image: 'grafana/grafana:latest', state: 'running', status: 'Up 5 hours', created: 0, ports: [{ private_port: 3000, public_port: 3001, port_type: 'tcp' }], project: 'monitoring' },
    { id: 'd9', name: 'monitoring-node-exporter', image: 'prom/node-exporter', state: 'exited', status: 'Exited (0)', created: 0, ports: [], project: 'monitoring' },
    { id: 'd10', name: 'redis-master', image: 'redis:7-alpine', state: 'running', status: 'Up 3 days', created: 0, ports: [{ private_port: 6379, public_port: 6379, port_type: 'tcp' }], project: 'redis-cluster' },
    { id: 'd11', name: 'redis-replica-1', image: 'redis:7-alpine', state: 'running', status: 'Up 3 days', created: 0, ports: [], project: 'redis-cluster' },
    { id: 'd12', name: 'redis-replica-2', image: 'redis:7-alpine', state: 'restarting', status: 'Restarting', created: 0, ports: [], project: 'redis-cluster' },
    { id: 'd13', name: 'frontend-next-1', image: 'node:20-alpine', state: 'running', status: 'Up 1 hour', created: 0, ports: [{ private_port: 3000, public_port: 3002, port_type: 'tcp' }], project: 'frontend' },
    { id: 'd14', name: 'frontend-cache-1', image: 'memcached:alpine', state: 'exited', status: 'Exited (0)', created: 0, ports: [], project: 'frontend' },
  ];

  const DEMO_NODES: SwarmNode[] = [
    { id: 'n1', hostname: 'manager-01', role: 'manager', status: 'ready', availability: 'active', engine_version: '24.0', ip: '192.168.1.10', os: 'linux', arch: 'amd64', cpus: 8, memory_bytes: 17179869184 },
    { id: 'n2', hostname: 'worker-01', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0', ip: '192.168.1.11', os: 'linux', arch: 'amd64', cpus: 4, memory_bytes: 8589934592 },
    { id: 'n3', hostname: 'worker-02', role: 'worker', status: 'ready', availability: 'active', engine_version: '24.0', ip: '192.168.1.12', os: 'linux', arch: 'amd64', cpus: 4, memory_bytes: 8589934592 },
  ];

  const DEMO_SERVICES: SwarmService[] = [
    { id: 's1', name: 'web_nginx', image: 'nginx:alpine', replicas_running: 2, replicas_desired: 2, ports: [{ published: 80, target: 80, protocol: 'tcp' }], updated_at: '', stack: 'web' },
    { id: 's2', name: 'api_kong', image: 'kong:3.4', replicas_running: 3, replicas_desired: 3, ports: [], updated_at: '', stack: 'api' },
  ];

  // Use demo data when no real data (Docker disconnected / empty)
  const useDemo = $derived($containers.length === 0);
  const displayContainers = $derived(useDemo ? DEMO_CONTAINERS : $containers);
  const displayNodes = $derived(useDemo ? DEMO_NODES : $nodes);
  const displayServices = $derived(useDemo ? DEMO_SERVICES : $services);
  // Demo shows swarm mode with multiple nodes; real data uses actual mode
  const displayMode = $derived(useDemo ? 'swarm' as const : $dockerMode);

  // ─── SPRITE PATHS (use RGBA/transparent assets only) ───
  const SPRITES = {
    rack: '/assets/system_overview_rack.png',
    desk: '/assets/system_overview_desk.png',
    worker: '/assets/system_overview_worker.png',
    bookshelf: '/assets/system_overview_storage.png',
    imageRack: '/assets/system_overview_storage.png',
  };

  const BG_IMAGE = '/assets/system_overview_bg_v2.png';

  // ─── LAYOUT (2x rack size, spread for room_empty_bg) ───
  const LAYOUT = {
    // Racks along back wall (5 slots, wider spacing)
    rackSlots: [
      { x: 12,  y: 24 },
      { x: 30,  y: 22 },
      { x: 50,  y: 26 },
      { x: 70,  y: 24 },
      { x: 88,  y: 22 },
    ],
    // Workers on floor, in front of each rack
    workerSlots: [
      { x: 12, y: 52 },
      { x: 30, y: 50 },
      { x: 50, y: 54 },
      { x: 70, y: 52 },
      { x: 88, y: 50 },
    ],
    // Console: front-left
    console: { x: 8, y: 85 },
    // Bookshelf: back-right
    bookshelf: { x: 90, y: 28 },
    maxSlotsPerRack: 12,
  };

  // ─── TYPES ───
  interface ComposeProject {
    name: string;
    containers: Container[];
    running: number;
    total: number;
    isActive: boolean;
  }

  interface RackSprite {
    id: string;
    project: ComposeProject;
    x: number;
    y: number;
  }

  interface WorkerSprite {
    id: string;
    project: ComposeProject;
    x: number;
    y: number;
    active: boolean;
  }

  // ─── STATE ───
  let frame = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  // Room background is CSS-only (dark gradient), no image needed

  // ─── DERIVED DATA ───
  const composeProjects = $derived.by(() => {
    const projectMap = new Map<string, Container[]>();

    for (const ctr of displayContainers) {
      const project = ctr.project?.trim() || '_standalone';
      if (!projectMap.has(project)) projectMap.set(project, []);
      projectMap.get(project)!.push(ctr);
    }

    const projects: ComposeProject[] = [];
    for (const [name, ctrs] of projectMap.entries()) {
      const running = ctrs.filter(c => c.state === 'running').length;
      projects.push({
        name,
        containers: ctrs,
        running,
        total: ctrs.length,
        isActive: running > 0,
      });
    }

    return projects.sort((a, b) => {
      if (a.name === '_standalone') return 1;
      if (b.name === '_standalone') return -1;
      return a.name.localeCompare(b.name);
    });
  });

  const racks = $derived(
    composeProjects.slice(0, LAYOUT.rackSlots.length).map((project, i) => ({
      id: `rack-${project.name}`,
      project,
      x: LAYOUT.rackSlots[i].x,
      y: LAYOUT.rackSlots[i].y,
    }))
  );

  const workers = $derived(
    composeProjects.slice(0, LAYOUT.workerSlots.length).map((project, i) => ({
      id: `worker-${project.name}`,
      project,
      x: LAYOUT.workerSlots[i].x,
      y: LAYOUT.workerSlots[i].y,
      active: project.isActive,
    }))
  );

  const runningCount = $derived(displayContainers.filter(c => c.state === 'running').length);
  const totalCount = $derived(displayContainers.length);
  const hostCount = $derived(displayMode === 'swarm' && displayNodes.length > 0 ? displayNodes.length : 1);
  const uniqueImageCount = $derived(new Set([
    ...displayServices.map(s => s.image),
    ...displayContainers.map(c => c.image),
  ]).size);

  // ─── ANIMATION ───
  onMount(() => {
    timer = setInterval(() => { frame += 1; }, 150);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });


  function projectLabel(name: string): string {
    return name === '_standalone' ? 'LOCAL' : name.toUpperCase();
  }

  function ledClass(state: string): string {
    if (state === 'running') return 'slot-running';
    if (state === 'exited' || state === 'dead') return 'slot-stopped';
    return 'slot-other';
  }
</script>

<div class="overview-shell pixel-panel">
  <!-- ═══ SCENE ═══ -->
  <div class="scene-shell pixel-border">
    <div class="scene-canvas" aria-label="SERVER ROOM OVERVIEW" style="--bg-image: url('{BG_IMAGE}')">
      <!-- Background: isometric server room (room_empty.png) -->

      <!-- Zone HUD tags -->
      <div class="zone-tag zone-hosts">
        <strong>HOSTS</strong>
        <span>{hostCount}</span>
      </div>
      <div class="zone-tag zone-containers">
        <strong>CONTAINERS</strong>
        <span>{runningCount}/{totalCount}</span>
      </div>
      <div class="zone-tag zone-images">
        <strong>IMAGES</strong>
        <span>{uniqueImageCount}</span>
      </div>

      <!-- Management console (fixed) -->
      <div class="furniture console" style="left:{LAYOUT.console.x}%;top:{LAYOUT.console.y}%;">
        <img src={SPRITES.desk} alt="Management Console" />
        <div class="furniture-label">CONSOLE</div>
      </div>

      <!-- Bookshelf / Images (fixed) -->
      <div class="furniture bookshelf" style="left:{LAYOUT.bookshelf.x}%;top:{LAYOUT.bookshelf.y}%;">
        <img src={SPRITES.bookshelf} alt="Docker Images" />
        <div class="furniture-label">IMAGES ({uniqueImageCount})</div>
      </div>

      <!-- Server Racks (dynamic per project, isometric depth by y) -->
      {#each racks as rack, i}
        <div
          class="rack"
          class:rack-active={rack.project.isActive}
          class:rack-inactive={!rack.project.isActive}
          style="left:{rack.x}%;top:{rack.y}%;z-index:{Math.round(rack.y) + 5};"
        >
          <img class="rack-img" src={SPRITES.rack} alt="" />

          <!-- LED slot grid overlay -->
          <div class="rack-slots">
            {#each rack.project.containers.slice(0, LAYOUT.maxSlotsPerRack) as ctr}
              <div
                class="slot {ledClass(ctr.state)}"
                class:slot-blink={ctr.state === 'restarting'}
                title="{ctr.name}: {ctr.state}"
              ></div>
            {/each}
            {#if rack.project.total > LAYOUT.maxSlotsPerRack}
              <div class="slot-overflow">+{rack.project.total - LAYOUT.maxSlotsPerRack}</div>
            {/if}
          </div>

          <!-- Rack label -->
          <div class="rack-label">
            <span class="rack-name">{projectLabel(rack.project.name)}</span>
            <span class="rack-count">{rack.project.running}/{rack.project.total}</span>
          </div>
        </div>
      {/each}

      <!-- Workers at active projects (isometric depth) -->
      {#each workers as worker}
        {#if worker.active}
          <div
            class="worker"
            style="left:{worker.x}%;top:{worker.y}%;z-index:{Math.round(worker.y) + 10};"
          >
            <img
              class="worker-img"
              class:worker-bob={frame % 8 < 4}
              src={SPRITES.worker}
              alt="Worker"
            />
          </div>
        {/if}
      {/each}

      <!-- Empty state (only when no demo data either) -->
      {#if composeProjects.length === 0 && !useDemo}
        <div class="empty-room">
          <span class="blink-text">WAITING FOR CONTAINERS...</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- ═══ DETAIL CARDS ═══ -->
  <div class="detail-grid">
    <section class="detail-card pixel-border">
      <h3 class="card-title">PROJECTS</h3>
      <div class="meta-row">
        <span>COUNT</span>
        <strong>{composeProjects.length}</strong>
      </div>
      <div class="list">
        {#if composeProjects.length === 0}
          <div class="empty-state">NO PROJECT DATA</div>
        {:else}
          {#each composeProjects as project}
            <div class="list-row">
              <span class="led" class:led-green={project.isActive} class:led-red={!project.isActive}></span>
              <span class="row-main">{projectLabel(project.name)}</span>
              <span class="row-sub">{project.containers.length} ctr</span>
              <span class="row-stat">{project.running}/{project.total}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <section class="detail-card pixel-border">
      <h3 class="card-title">CONTAINERS</h3>
      <div class="meta-row">
        <span>RUNNING / TOTAL</span>
        <strong>{runningCount}/{totalCount}</strong>
      </div>
      <div class="list">
        {#if displayContainers.length === 0}
          <div class="empty-state">NO CONTAINER DATA</div>
        {:else}
          {#each displayContainers as ctr}
            <div class="list-row" class:inactive={ctr.state !== 'running'}>
              <span class="led" class:led-green={ctr.state === 'running'} class:led-red={ctr.state === 'exited' || ctr.state === 'dead'} class:led-yellow={ctr.state !== 'running' && ctr.state !== 'exited' && ctr.state !== 'dead'}></span>
              <span class="row-main">{ctr.name.length > 20 ? ctr.name.slice(0, 20) + '...' : ctr.name}</span>
              <span class="row-sub">{ctr.image.split('@')[0].split('/').slice(-1)[0]}</span>
              <span class="row-stat">{ctr.state.toUpperCase()}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <section class="detail-card pixel-border">
      <h3 class="card-title">HOST INFO</h3>
      <div class="meta-row">
        <span>MODE</span>
        <strong>{displayMode.toUpperCase()}{#if useDemo} (DEMO){/if}</strong>
      </div>
      <div class="list">
        {#if displayMode === 'swarm'}
          {#each displayNodes as node}
            <div class="list-row">
              <span class="led" class:led-green={node.status === 'ready'} class:led-red={node.status !== 'ready'}></span>
              <span class="row-main">{node.hostname}</span>
              <span class="row-sub">{node.role}</span>
              <span class="row-stat">{node.status.toUpperCase()}</span>
            </div>
          {/each}
        {:else}
          <div class="list-row">
            <span class="led led-green"></span>
            <span class="row-main">LOCAL ENGINE</span>
            <span class="row-sub">{totalCount} containers</span>
            <span class="row-stat">ACTIVE</span>
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  /* ═══ SHELL ═══ */
  .overview-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background:
      radial-gradient(circle at 50% 0%, rgba(97, 219, 255, 0.16), transparent 44%),
      linear-gradient(180deg, #060a1b 0%, #0b0f21 100%);
  }

  .scene-shell {
    overflow: hidden;
    border-color: #235a88;
    background: #040812;
    box-shadow:
      inset 0 0 24px rgba(0, 0, 0, 0.5),
      0 0 28px rgba(59, 180, 255, 0.2);
  }

  .scene-canvas {
    position: relative;
    aspect-ratio: 1376 / 768;
    width: 100%;
    background:
      linear-gradient(to bottom, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.3)),
      var(--bg-image, url('/assets/room_empty_bg.png')) center center / cover no-repeat;
    background-color: #0a0e1a;
  }

  .scene-canvas::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background:
      linear-gradient(to bottom, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.2)),
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.04) 2px, rgba(0, 0, 0, 0.04) 4px);
  }

  /* ═══ ZONE HUD TAGS ═══ */
  .zone-tag {
    position: absolute;
    z-index: 14;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px 7px;
    font-size: 6px;
    letter-spacing: 1px;
    color: #bdd0ec;
    border: 2px solid rgba(127, 198, 255, 0.85);
    background: rgba(6, 14, 32, 0.8);
  }

  .zone-tag strong { font-size: 8px; color: #f2f7ff; }
  .zone-hosts { left: 3%; top: 3%; }
  .zone-containers { left: 37%; top: 3%; }
  .zone-images { right: 3%; top: 3%; }

  /* ═══ FURNITURE (fixed objects) ═══ */
  .furniture {
    position: absolute;
    z-index: 5;
    pointer-events: none;
  }

  .furniture img {
    width: clamp(90px, 14vw, 180px);
    height: auto;
    display: block;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
    background: transparent;
  }

  .furniture-label {
    font-size: 6px;
    color: #9fd1ef;
    text-align: center;
    margin-top: 2px;
    letter-spacing: 1px;
  }

  .console { transform: translate(-50%, -50%) scale(1.14); transform-origin: center bottom; }
  .bookshelf { transform: translate(-50%, -50%); transform-origin: center bottom; }

  /* ═══ SERVER RACKS (dynamic per project, isometric) ═══ */
  .rack {
    position: absolute;
    transform: translate(-50%, -75%) scale(0.95);
    transform-origin: center bottom;
    transition: opacity 0.3s;
  }

  .rack-img {
    width: clamp(130px, 24vw, 280px);
    height: auto;
    display: block;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
    background: transparent;
  }

  .rack-inactive {
    opacity: 0.5;
    filter: saturate(0.4);
  }

  /* LED slots overlaid on rack */
  .rack-slots {
    position: absolute;
    top: 22%;
    left: 18%;
    width: 64%;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    z-index: 9;
  }

  .slot {
    width: clamp(8px, 1.2vw, 14px);
    height: clamp(8px, 1.2vw, 14px);
    border-radius: 1px;
  }

  .slot-running {
    background: #4ade80;
    box-shadow: 0 0 4px rgba(74, 222, 128, 0.6);
  }

  .slot-stopped {
    background: #ef4444;
    box-shadow: 0 0 3px rgba(239, 68, 68, 0.4);
  }

  .slot-other {
    background: #facc15;
    box-shadow: 0 0 3px rgba(250, 204, 21, 0.4);
  }

  .slot-blink { animation: blink-led 0.8s step-end infinite; }
  @keyframes blink-led { 50% { opacity: 0.3; } }

  .slot-overflow {
    font-size: 5px;
    color: #9fd1ef;
    padding: 0 2px;
  }

  .rack-label {
    text-align: center;
    margin-top: 6px;
  }

  .rack-name {
    display: block;
    font-size: 8px;
    color: #ecf8ff;
    letter-spacing: 0.5px;
  }

  .rack-count {
    font-size: 7px;
    color: #9fd1ef;
  }

  /* ═══ WORKERS (isometric floor placement) ═══ */
  .worker {
    position: absolute;
    transform: translate(-50%, -65%) scale(0.9);
    transform-origin: center bottom;
    pointer-events: none;
  }

  .worker-img {
    width: clamp(56px, 9vw, 100px);
    height: auto;
    display: block;
    image-rendering: pixelated;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.45));
    background: transparent;
  }

  .worker-bob {
    margin-top: -2px;
  }

  /* ═══ EMPTY STATE ═══ */
  .empty-room {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 15;
    font-size: 8px;
    color: #9fd1ef;
    letter-spacing: 1px;
  }

  .blink-text { animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  /* ═══ DETAIL CARDS ═══ */
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .detail-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 210px;
    padding: 10px;
    background: rgba(7, 10, 24, 0.86);
    border-color: #354768;
  }

  .card-title {
    font-size: 9px;
    letter-spacing: 1px;
    color: #f5f9ff;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(58, 58, 92, 0.75);
    font-size: 7px;
    color: #95a8c5;
  }

  .meta-row strong { color: #ebf2ff; font-size: 8px; }

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 150px;
    overflow: auto;
    padding-right: 2px;
  }

  .list-row {
    display: grid;
    grid-template-columns: 12px 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    font-size: 7px;
    background: rgba(12, 19, 38, 0.92);
    border: 1px solid rgba(74, 99, 141, 0.6);
  }

  .list-row.inactive {
    opacity: 0.65;
    border-color: rgba(150, 80, 80, 0.7);
  }

  .row-main, .row-sub, .row-stat {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-main { color: #e4edff; }
  .row-sub { color: #9cb0cb; }
  .row-stat { color: #d3ebff; }

  .empty-state {
    padding: 8px 6px;
    font-size: 7px;
    color: #95a8c5;
    text-align: center;
    border: 1px dashed rgba(96, 165, 250, 0.6);
    background: rgba(10, 14, 30, 0.8);
  }

  @media (max-width: 980px) {
    .detail-grid { grid-template-columns: 1fr; }
    .zone-tag { display: none; }
    .furniture-label { display: none; }
  }
</style>
