<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { containers, dockerMode, nodes, services } from '$lib/stores/swarm';
  import type { Container } from '$lib/utils/ws';

  // ─── SPRITE PATHS (swap these when you have new assets) ───
  const SPRITES = {
    rack: '/assets/rack_nobg.png',        // server rack = compose project
    desk: '/assets/desk_nobg.png',        // management console (3-monitor workstation)
    worker: '/assets/worker_nobg.png',    // IT technician worker
    bookshelf: '/assets/bookshelf.png',   // docker images storage
    imageRack: '/assets/new_rack.png',    // alternative images display
  };

  // ─── LAYOUT CONFIG (tune positions here) ───
  const LAYOUT = {
    // Rack positions along the back wall (isometric, % based)
    // Up to 6 racks, arranged left-to-right with isometric offset
    rackSlots: [
      { x: 8,  y: 22 },
      { x: 22, y: 22 },
      { x: 36, y: 22 },
      { x: 50, y: 22 },
      { x: 64, y: 22 },
      { x: 78, y: 22 },
    ],
    // Worker positions (in front of each rack)
    workerSlots: [
      { x: 10, y: 55 },
      { x: 24, y: 55 },
      { x: 38, y: 55 },
      { x: 52, y: 55 },
      { x: 66, y: 55 },
      { x: 80, y: 55 },
    ],
    // Fixed furniture
    console: { x: 4, y: 70 },      // node_desk management console
    bookshelf: { x: 85, y: 25 },   // docker images bookshelf
    // Max containers shown as LED slots per rack
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

    for (const ctr of $containers) {
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

  const runningCount = $derived($containers.filter(c => c.state === 'running').length);
  const totalCount = $derived($containers.length);
  const hostCount = $derived($dockerMode === 'swarm' && $nodes.length > 0 ? $nodes.length : 1);
  const uniqueImageCount = $derived(new Set([
    ...$services.map(s => s.image),
    ...$containers.map(c => c.image),
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
    <div class="scene-canvas" aria-label="SERVER ROOM OVERVIEW">
      <!-- Background is CSS gradient on .scene-canvas -->

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

      <!-- Server Racks (dynamic per project) -->
      {#each racks as rack}
        <div
          class="rack"
          class:rack-active={rack.project.isActive}
          class:rack-inactive={!rack.project.isActive}
          style="left:{rack.x}%;top:{rack.y}%;"
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

      <!-- Workers at active projects -->
      {#each workers as worker}
        {#if worker.active}
          <div
            class="worker"
            style="left:{worker.x}%;top:{worker.y}%;"
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

      <!-- Empty state -->
      {#if composeProjects.length === 0}
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
        {#if $containers.length === 0}
          <div class="empty-state">NO CONTAINER DATA</div>
        {:else}
          {#each $containers as ctr}
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
        <strong>{$dockerMode.toUpperCase()}</strong>
      </div>
      <div class="list">
        {#if $dockerMode === 'swarm'}
          {#each $nodes as node}
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
      /* ceiling lights glow */
      radial-gradient(ellipse 30% 20% at 25% 0%, rgba(80, 180, 255, 0.08), transparent),
      radial-gradient(ellipse 30% 20% at 50% 0%, rgba(80, 180, 255, 0.1), transparent),
      radial-gradient(ellipse 30% 20% at 75% 0%, rgba(80, 180, 255, 0.08), transparent),
      /* raised floor tile pattern */
      repeating-linear-gradient(90deg, rgba(40, 60, 90, 0.15) 0px, rgba(40, 60, 90, 0.15) 1px, transparent 1px, transparent 48px),
      repeating-linear-gradient(0deg, rgba(40, 60, 90, 0.12) 0px, rgba(40, 60, 90, 0.12) 1px, transparent 1px, transparent 48px),
      /* base gradient - dark server room */
      linear-gradient(180deg, #070b1a 0%, #0a0e1e 40%, #0d1225 100%);
  }

  .scene-canvas::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    background:
      linear-gradient(to bottom, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.25)),
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.07) 2px, rgba(0, 0, 0, 0.07) 4px);
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
    width: clamp(50px, 8vw, 100px);
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
  }

  .furniture-label {
    font-size: 6px;
    color: #9fd1ef;
    text-align: center;
    margin-top: 2px;
    letter-spacing: 1px;
  }

  .console { transform: translate(-50%, -50%); }
  .bookshelf { transform: translate(-50%, -50%); }

  /* ═══ SERVER RACKS (dynamic per project) ═══ */
  .rack {
    position: absolute;
    z-index: 8;
    transform: translate(-50%, -80%);
    transition: opacity 0.3s;
  }

  .rack-img {
    width: clamp(40px, 7vw, 90px);
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
    display: block;
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
    width: clamp(4px, 0.6vw, 7px);
    height: clamp(4px, 0.6vw, 7px);
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
    margin-top: 4px;
  }

  .rack-name {
    display: block;
    font-size: 6px;
    color: #ecf8ff;
    letter-spacing: 0.5px;
  }

  .rack-count {
    font-size: 5px;
    color: #9fd1ef;
  }

  /* ═══ WORKERS ═══ */
  .worker {
    position: absolute;
    z-index: 10;
    transform: translate(-50%, -70%);
    pointer-events: none;
  }

  .worker-img {
    width: clamp(40px, 6vw, 80px);
    image-rendering: pixelated;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.45));
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
