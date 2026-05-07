<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { containers, dockerMode, nodes, services, selectedContainer } from '$lib/stores/swarm';
  import { initSound, playClick } from '$lib/stores/sound';
  import { currentScenePalette, applyScenePalette } from '$lib/stores/scenePalette';
  import ContainerDetail from './ContainerDetail.svelte';
  import type { Container } from '$lib/utils/ws';
  import type { SwarmNode, SwarmService } from '$lib/utils/ws';

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

  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    type: 'smoke' | 'sparkle';
  }

  // ─── STATE ───
  let frame = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  // Canvas particle state
  let particleCanvas: HTMLCanvasElement;
  let sceneCanvasEl: HTMLDivElement;
  let animFrameId = 0;
  let resizeObserver: ResizeObserver;
  let particles: Particle[] = [];
  let lastFrameTime = 0;
  const MAX_PARTICLES = 20;

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

  // Selected container object for ContainerDetail panel
  const selectedContainerObj = $derived(
    $selectedContainer
      ? ($containers.find(c => c.id === $selectedContainer) ?? null)
      : null
  );

  // ─── HELPERS ───
  function rackStateClass(project: ComposeProject): string {
    const ctrs = project.containers;
    if (ctrs.some(c => c.state === 'exited' || c.state === 'dead')) return 'rack-error';
    if (ctrs.some(c => c.state === 'restarting')) return 'rack-restarting';
    if (project.running === project.total && project.total > 0) return 'rack-running';
    return 'rack-stopped';
  }

  function projectLabel(name: string): string {
    return name === '_standalone' ? 'LOCAL' : name.toUpperCase();
  }

  function ledClass(state: string): string {
    if (state === 'running') return 'slot-running';
    if (state === 'exited' || state === 'dead') return 'slot-stopped';
    return 'slot-other';
  }

  // ─── PARTICLE SYSTEM ───
  function spawnParticles(canvasWidth: number, canvasHeight: number): void {
    for (const rack of racks) {
      if (particles.length >= MAX_PARTICLES) break;
      const px = (rack.x / 100) * canvasWidth;
      const py = (rack.y / 100) * canvasHeight;

      const hasError = rack.project.containers.some(
        c => c.state === 'exited' || c.state === 'dead'
      );
      const isHealthy =
        rack.project.running === rack.project.total && rack.project.total > 0;

      if (hasError && Math.random() < 0.3) {
        particles.push({
          x: px + (Math.random() - 0.5) * 20,
          y: py,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.5 - Math.random() * 0.5,
          life: 60,
          maxLife: 60,
          type: 'smoke',
        });
      } else if (isHealthy && Math.random() < 0.15) {
        particles.push({
          x: px + (Math.random() - 0.5) * 20,
          y: py,
          vx: (Math.random() - 0.5) * 1,
          vy: -1 - Math.random(),
          life: 30,
          maxLife: 30,
          type: 'sparkle',
        });
      }
    }
  }

  function drawParticles(timestamp: number): void {
    if (!particleCanvas) return;
    const ctx = particleCanvas.getContext('2d');
    if (!ctx) return;

    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    // RPi4 perf guard: slow frame → clear particles and skip spawning
    if (delta > 33) {
      particles = [];
      animFrameId = requestAnimationFrame(drawParticles);
      return;
    }

    spawnParticles(particleCanvas.width, particleCanvas.height);
    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      const alpha = p.life / p.maxLife;

      if (p.type === 'smoke') {
        const radius = 3 + (1 - alpha) * 6;
        ctx.fillStyle = `rgba(180, 180, 180, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    }

    animFrameId = requestAnimationFrame(drawParticles);
  }

  // ─── CLICK-TO-FOCUS HANDLERS ───
  function handleRackClick(project: ComposeProject): void {
    initSound();
    playClick();
    const firstId = project.containers[0]?.id ?? null;
    selectedContainer.set(firstId);
  }

  function handleRackKeydown(e: KeyboardEvent, project: ComposeProject): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRackClick(project);
    }
  }

  function handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape') selectedContainer.set(null);
  }

  // ─── PALETTE ───
  $effect(() => {
    if (sceneCanvasEl) applyScenePalette($currentScenePalette, sceneCanvasEl);
  });

  // ─── LIFECYCLE ───
  onMount(() => {
    timer = setInterval(() => { frame += 1; }, 150);

    // Canvas particle setup
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        particleCanvas.width = entry.contentRect.width;
        particleCanvas.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(sceneCanvasEl);

    if (!reducedMotion) {
      animFrameId = requestAnimationFrame(drawParticles);
    }
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<svelte:window onkeydown={handleEscape} />

<div class="overview-shell pixel-panel">
  <!-- ═══ SCENE ═══ -->
  <div class="scene-shell pixel-border">
    <div
      bind:this={sceneCanvasEl}
      class="scene-canvas"
      aria-label="SERVER ROOM OVERVIEW"
      style="--bg-image: url('{BG_IMAGE}')"
    >
      <!-- Background: isometric server room (room_empty.png) -->

      <!-- Particle canvas overlay -->
      <canvas bind:this={particleCanvas} class="particle-canvas"></canvas>

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
          class="rack rack-focusable {rackStateClass(rack.project)}"
          class:rack-active={rack.project.isActive}
          class:rack-inactive={!rack.project.isActive}
          style="left:{rack.x}%;top:{rack.y}%;z-index:{Math.round(rack.y) + 5};"
          tabindex="0"
          role="button"
          aria-label="Project {rack.project.name}: {rack.project.running}/{rack.project.total} containers"
          onclick={() => handleRackClick(rack.project)}
          onkeydown={(e) => handleRackKeydown(e, rack.project)}
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

<!-- ContainerDetail slide-out panel -->
{#if $selectedContainer && selectedContainerObj}
  <ContainerDetail
    containerId={$selectedContainer}
    containerName={selectedContainerObj.name}
    onClose={() => selectedContainer.set(null)}
  />
{/if}

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
    background-color: var(--scene-floor, #0a0e1a);
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

  /* ═══ PARTICLE CANVAS ═══ */
  .particle-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 65;
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
    color: var(--scene-cable-b, #bdd0ec);
    border: 2px solid var(--scene-cable-a, rgba(127, 198, 255, 0.85));
    background: rgba(6, 14, 32, 0.8);
  }

  .zone-tag strong { font-size: 8px; color: var(--scene-text-accent, #f2f7ff); }
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
    color: var(--scene-text-secondary, #9fd1ef);
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
    cursor: pointer;
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
    background: var(--scene-led-running, #4ade80);
    box-shadow: 0 0 4px var(--scene-led-running, rgba(74, 222, 128, 0.6));
  }

  .slot-stopped {
    background: var(--scene-led-stopped, #ef4444);
    box-shadow: 0 0 3px var(--scene-led-stopped, rgba(239, 68, 68, 0.4));
  }

  .slot-other {
    background: var(--scene-led-other, #facc15);
    box-shadow: 0 0 3px var(--scene-led-other, rgba(250, 204, 21, 0.4));
  }

  .slot-blink { animation: blink-led 0.8s step-end infinite; }
  @keyframes blink-led { 50% { opacity: 0.3; } }

  .slot-overflow {
    font-size: 5px;
    color: var(--scene-text-secondary, #9fd1ef);
    padding: 0 2px;
  }

  .rack-label {
    text-align: center;
    margin-top: 6px;
  }

  .rack-name {
    display: block;
    font-size: 8px;
    color: var(--scene-text-primary, #ecf8ff);
    letter-spacing: 0.5px;
  }

  .rack-count {
    font-size: 7px;
    color: var(--scene-text-secondary, #9fd1ef);
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
    color: var(--scene-text-secondary, #9fd1ef);
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
    background: var(--scene-card-bg, rgba(7, 10, 24, 0.86));
    border-color: var(--scene-border-primary, #354768);
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
