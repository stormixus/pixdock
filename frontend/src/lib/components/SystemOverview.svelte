<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { containers, dockerMode, nodes, services } from '$lib/stores/swarm';
  import type { Container } from '$lib/utils/ws';

  interface ComposeService {
    id: string;
    project: string;
    service: string;
    image: string;
    containers: Container[];
    running: number;
    total: number;
    ports: number[];
    state: 'healthy' | 'degraded' | 'stopped';
  }

  interface ComposeProject {
    name: string;
    services: ComposeService[];
    running: number;
    total: number;
  }

  interface SceneProject extends ComposeProject {
    x: number;
    y: number;
  }

  interface SceneService extends ComposeService {
    x: number;
    y: number;
  }

  interface BuildCrate {
    id: string;
    state: string;
    x: number;
    y: number;
  }

  interface ReplicaSprite {
    id: string;
    state: string;
    x: number;
    y: number;
    label: string;
  }

  interface LinkWire {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    kind: 'project' | 'runtime';
  }

  interface AgentSprite {
    id: string;
    x: number;
    y: number;
    flip: boolean;
  }

  const FLOW_STEPS = ['COMPOSE UP', 'CREATE NETWORK', 'START SERVICE', 'SCALE REPLICA'];

  const PROJECT_SLOTS = [
    { x: 15, y: 31 },
    { x: 19, y: 46 },
    { x: 22, y: 61 },
    { x: 26, y: 74 }
  ];

  const SERVICE_SLOTS = [
    { x: 44, y: 35 },
    { x: 56, y: 40 },
    { x: 68, y: 45 },
    { x: 48, y: 54 },
    { x: 60, y: 59 },
    { x: 72, y: 64 }
  ];

  const Y_TO_X_RATIO = 768 / 1376;

  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let roomBgSrc = '/assets/room_empty.png';

  let composeProjects: ComposeProject[] = [];
  let composeServices: ComposeService[] = [];
  let sceneProjects: SceneProject[] = [];
  let sceneServices: SceneService[] = [];
  let buildCrates: BuildCrate[] = [];
  let replicaSprites: ReplicaSprite[] = [];
  let networkLinks: LinkWire[] = [];
  let whaleAgents: AgentSprite[] = [];

  let runningCount = 0;
  let totalCount = 0;
  let hostCount = 1;
  let uniqueImageCount = 0;

  onMount(() => {
    timer = setInterval(() => {
      frame += 1;
    }, 110);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  function handleRoomBgError() {
    if (roomBgSrc !== '/assets/server_room_bg.jpg') {
      roomBgSrc = '/assets/server_room_bg.jpg';
    }
  }

  function normalizeProject(project: string | null): string {
    if (!project) return '_standalone';
    return project.trim() || '_standalone';
  }

  function projectLabel(name: string): string {
    return name === '_standalone' ? 'LOCAL' : name.toUpperCase();
  }

  function shortImage(image: string): string {
    const clean = image.split('@')[0];
    const parts = clean.split('/');
    return parts.length > 2 ? parts.slice(-2).join('/') : clean;
  }

  function shortName(name: string): string {
    return name.length > 12 ? `${name.slice(0, 12)}...` : name;
  }

  function extractServiceName(container: Container): string {
    const cleanName = container.name.replace(/^\/+/, '');
    const project = normalizeProject(container.project);

    let service = cleanName;
    if (project !== '_standalone') {
      service = service
        .replace(new RegExp(`^${project}[-_]`, 'i'), '')
        .replace(new RegExp(`[-_]${project}$`, 'i'), '');
    }

    service = service.replace(/[-_]\d+$/, '');
    return service || cleanName;
  }

  function serviceHealth(running: number, total: number): 'healthy' | 'degraded' | 'stopped' {
    if (running === 0) return 'stopped';
    if (running < total) return 'degraded';
    return 'healthy';
  }

  function statefulService(service: ComposeService): boolean {
    const probe = `${service.service} ${service.image}`.toLowerCase();
    return /(db|postgres|mysql|mariadb|mongo|redis|elastic|influx|kafka|rabbit)/.test(probe);
  }

  function serviceLedClass(state: ComposeService['state']): string {
    if (state === 'healthy') return 'led-green';
    if (state === 'degraded') return 'led-yellow';
    return 'led-red';
  }

  function replicaLedClass(state: string): string {
    if (state === 'running') return 'led-green';
    if (state === 'restarting' || state === 'paused') return 'led-yellow';
    return 'led-red';
  }

  function wireStyle(link: LinkWire): string {
    const dx = link.x2 - link.x1;
    const dyNorm = (link.y2 - link.y1) * Y_TO_X_RATIO;
    const length = Math.sqrt((dx * dx) + (dyNorm * dyNorm));
    const angle = Math.atan2(dyNorm, dx) * (180 / Math.PI);
    return `left:${link.x1}%;top:${link.y1}%;width:${length.toFixed(2)}%;transform:rotate(${angle.toFixed(2)}deg);`;
  }

  $: hostCount = $dockerMode === 'swarm' && $nodes.length > 0 ? $nodes.length : 1;
  $: runningCount = $containers.filter((c) => c.state === 'running').length;
  $: totalCount = $containers.length;
  $: uniqueImageCount = new Set([
    ...$services.map((service) => service.image),
    ...$containers.map((container) => container.image)
  ]).size;

  $: {
    const projectToServices = new Map<string, Map<string, ComposeService>>();

    for (const container of $containers) {
      const project = normalizeProject(container.project);
      const service = extractServiceName(container);

      if (!projectToServices.has(project)) {
        projectToServices.set(project, new Map());
      }

      const serviceMap = projectToServices.get(project)!;
      if (!serviceMap.has(service)) {
        serviceMap.set(service, {
          id: `${project}/${service}`,
          project,
          service,
          image: container.image,
          containers: [],
          running: 0,
          total: 0,
          ports: [],
          state: 'stopped'
        });
      }

      const bucket = serviceMap.get(service)!;
      bucket.containers.push(container);
      bucket.total += 1;
      if (container.state === 'running') {
        bucket.running += 1;
      }

      if (!bucket.image) {
        bucket.image = container.image;
      }

      for (const port of container.ports) {
        if (port.public_port !== null) {
          bucket.ports.push(port.public_port);
        }
      }
    }

    const nextProjects: ComposeProject[] = [];
    const nextServices: ComposeService[] = [];

    for (const [projectName, serviceMap] of projectToServices.entries()) {
      const groupedServices = [...serviceMap.values()]
        .map((service) => ({
          ...service,
          ports: [...new Set(service.ports)].sort((a, b) => a - b),
          state: serviceHealth(service.running, service.total)
        }))
        .sort((a, b) => a.service.localeCompare(b.service));

      nextServices.push(...groupedServices);

      nextProjects.push({
        name: projectName,
        services: groupedServices,
        running: groupedServices.reduce((sum, svc) => sum + svc.running, 0),
        total: groupedServices.reduce((sum, svc) => sum + svc.total, 0)
      });
    }

    composeProjects = nextProjects.sort((a, b) => {
      if (a.name === '_standalone') return 1;
      if (b.name === '_standalone') return -1;
      return a.name.localeCompare(b.name);
    });

    composeServices = nextServices.sort((a, b) => {
      if (a.project !== b.project) return a.project.localeCompare(b.project);
      return a.service.localeCompare(b.service);
    });
  }

  $: sceneProjects = composeProjects.slice(0, PROJECT_SLOTS.length).map((project, idx) => ({
    ...project,
    x: PROJECT_SLOTS[idx].x,
    y: PROJECT_SLOTS[idx].y
  }));

  $: sceneServices = composeServices.slice(0, SERVICE_SLOTS.length).map((service, idx) => ({
    ...service,
    x: SERVICE_SLOTS[idx].x,
    y: SERVICE_SLOTS[idx].y
  }));

  $: buildCrates = sceneServices.map((service, idx) => {
    const phase = ((frame * 0.018) + (idx * 0.17)) % 1;
    return {
      id: `build-${service.id}`,
      state: service.state,
      x: 35 + ((service.x - 35) * phase),
      y: 28 + ((service.y - 28) * phase)
    };
  });

  $: {
    const sprites: ReplicaSprite[] = [];

    for (const [serviceIndex, service] of sceneServices.entries()) {
      const baseX = service.x + 11;
      const baseY = service.y + 7;

      for (const [containerIndex, container] of service.containers.slice(0, 4).entries()) {
        const phase = ((frame * 0.026) + (serviceIndex * 0.13) + (containerIndex * 0.22)) % 1;
        const theta = phase * Math.PI * 2;

        sprites.push({
          id: `${service.id}-${container.id}`,
          state: container.state,
          x: baseX + (Math.cos(theta) * 3.8),
          y: baseY + (Math.sin(theta) * 2.2),
          label: `${containerIndex + 1}`
        });
      }
    }

    replicaSprites = sprites;
  }

  $: {
    const links: LinkWire[] = [];

    const projectAnchor = new Map(sceneProjects.map((project) => [project.name, project]));

    for (const service of sceneServices) {
      const project = projectAnchor.get(service.project);
      if (project) {
        links.push({
          id: `project-${service.id}`,
          x1: project.x + 8,
          y1: project.y + 2,
          x2: service.x + 6,
          y2: service.y + 3,
          kind: 'project'
        });
      }

      links.push({
        id: `runtime-${service.id}`,
        x1: service.x + 8,
        y1: service.y + 8,
        x2: 84,
        y2: 62,
        kind: 'runtime'
      });
    }

    networkLinks = links;
  }

  $: whaleAgents = [0, 1].map((idx) => {
    const phase = ((frame * 0.017) + (idx * 0.49)) % 1;
    const radians = phase * Math.PI * 2;

    return {
      id: `whale-${idx}`,
      x: idx === 0 ? 34 + Math.sin(radians) * 8 : 63 + Math.sin(radians + 0.7) * 6,
      y: idx === 0 ? 77 + Math.cos(radians) * 2.8 : 70 + Math.cos(radians + 0.7) * 3,
      flip: Math.cos(radians) > 0
    };
  });
</script>

<div class="overview-shell pixel-panel">
  <div class="scene-shell pixel-border">
    <div class="scene-canvas" aria-label="COMPOSE OVERVIEW ROOM">
      <img class="room-bg" src={roomBgSrc} alt="" onerror={handleRoomBgError} />

      <img class="piece server-core" src="/assets/new_server.png" alt="" />
      <img class="piece image-rack" src="/assets/new_rack.png" alt="" />

      <div class="project-zone-title">PROJECTS</div>
      {#each sceneProjects as project}
        <div class="project-board" style="left:{project.x}%; top:{project.y}%;" title={project.name}>
          <strong>{projectLabel(project.name)}</strong>
          <span>{project.services.length} SVC</span>
          <span>{project.running}/{project.total} RUN</span>
        </div>
      {/each}

      <div class="repo-stack">
        {#each composeServices.slice(0, 6) as service}
          <div class="repo-card" title={service.image}>{service.service}</div>
        {/each}
      </div>

      {#each networkLinks as link}
        <div class="network-wire {link.kind}" style={wireStyle(link)}></div>
      {/each}

      {#each sceneServices as service}
        <div
          class="service-node"
          class:service-healthy={service.state === 'healthy'}
          class:service-degraded={service.state === 'degraded'}
          class:service-stopped={service.state === 'stopped'}
          style="left:{service.x}%; top:{service.y}%;"
          title={`${service.project}/${service.service}`}
        >
          <img class="service-desk" src="/assets/new_desk.png" alt="" />
          <div class="service-badge">{service.service}</div>
          <div class="service-meta">{service.running}/{service.total}</div>
          {#if statefulService(service)}
            <div class="volume-chip">VOL</div>
          {/if}
        </div>
      {/each}

      <div class="runtime-cluster">
        <span>RUNTIME</span>
      </div>

      {#each buildCrates as crate}
        <div
          class="build-crate"
          class:crate-idle={crate.state !== 'healthy'}
          style="left:{crate.x.toFixed(2)}%; top:{crate.y.toFixed(2)}%;"
        ></div>
      {/each}

      {#each replicaSprites as replica}
        <div
          class="replica-dot"
          class:replica-off={replica.state !== 'running'}
          style="left:{replica.x.toFixed(2)}%; top:{replica.y.toFixed(2)}%;"
          title={`Replica ${replica.label}`}
        >
          <span>{replica.label}</span>
        </div>
      {/each}

      {#each whaleAgents as whale}
        <img
          class="agent-whale"
          class:flip={whale.flip}
          src="/assets/agent_whale.png"
          alt=""
          style="left:{whale.x.toFixed(2)}%; top:{whale.y.toFixed(2)}%;"
        />
      {/each}

      <div class="zone-tag zone-hosts">
        <strong>HOST</strong>
        <span>{hostCount}</span>
      </div>

      <div class="zone-tag zone-images">
        <strong>IMAGES</strong>
        <span>{uniqueImageCount}</span>
      </div>

      <div class="zone-tag zone-runtime">
        <strong>REPLICAS</strong>
        <span>{runningCount}/{totalCount}</span>
      </div>

      <div class="flow-strip">
        {#each FLOW_STEPS as step, idx}
          <span>{step}</span>
          {#if idx < FLOW_STEPS.length - 1}
            <span class="flow-arrow">&#9654;</span>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <div class="detail-grid">
    <section class="detail-card project-card pixel-border">
      <h3 class="card-title">COMPOSE PROJECTS</h3>
      <div class="meta-row">
        <span>PROJECT COUNT</span>
        <strong>{composeProjects.length}</strong>
      </div>
      <div class="list">
        {#if composeProjects.length === 0}
          <div class="empty-state">NO PROJECT METADATA</div>
        {:else}
          {#each composeProjects as project}
            <div class="list-row">
              <span class="row-main">{projectLabel(project.name)}</span>
              <span class="row-sub">{project.services.length} svc</span>
              <span class="row-stat">{project.running}/{project.total}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <section class="detail-card service-card pixel-border">
      <h3 class="card-title">SERVICES</h3>
      <div class="meta-row">
        <span>SERVICE COUNT</span>
        <strong>{composeServices.length}</strong>
      </div>
      <div class="list">
        {#if composeServices.length === 0}
          <div class="empty-state">NO SERVICE METADATA</div>
        {:else}
          {#each composeServices as service}
            <div class="list-row list-row-service">
              <span class="led {serviceLedClass(service.state)}" class:blink={service.state === 'degraded'}></span>
              <span class="row-main">{service.service}</span>
              <span class="row-sub">{projectLabel(service.project)}</span>
              <span class="row-stat">{service.running}/{service.total}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <section class="detail-card replica-card pixel-border">
      <h3 class="card-title">CONTAINER REPLICAS</h3>
      <div class="meta-row">
        <span>RUNNING / TOTAL</span>
        <strong>{runningCount}/{totalCount}</strong>
      </div>
      <div class="list">
        {#if $containers.length === 0}
          <div class="empty-state">NO CONTAINER DATA</div>
        {:else}
          {#each $containers as container}
            <div class="list-row list-row-replica" class:inactive={container.state !== 'running'}>
              <span class="led {replicaLedClass(container.state)}" class:blink={container.state === 'restarting'}></span>
              <span class="row-main">{shortName(container.name)}</span>
              <span class="row-sub">{shortImage(container.image)}</span>
              <span class="row-stat">{container.state.toUpperCase()}</span>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
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
    background: linear-gradient(180deg, rgba(8, 12, 32, 0.96), rgba(9, 10, 24, 0.99));
  }

  .scene-canvas::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 20;
    background:
      linear-gradient(to bottom, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.25)),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.07) 2px,
        rgba(0, 0, 0, 0.07) 4px
      );
  }

  .room-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    z-index: 1;
  }

  .piece {
    position: absolute;
    image-rendering: pixelated;
    pointer-events: none;
    z-index: 5;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
  }

  .server-core {
    left: -1%;
    top: 20%;
    width: 21%;
  }

  .image-rack {
    left: 30.5%;
    top: 19.5%;
    width: 23%;
  }

  .project-zone-title {
    position: absolute;
    left: 4%;
    top: 23%;
    z-index: 8;
    font-size: 7px;
    letter-spacing: 1px;
    color: #bbe6ff;
    border: 1px solid #79c8ff;
    background: rgba(5, 20, 38, 0.78);
    padding: 3px 5px;
  }

  .project-board {
    position: absolute;
    z-index: 9;
    min-width: 11%;
    transform: translate(-50%, -50%) skewX(-15deg);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 6px;
    border: 2px solid #5cb5f4;
    background: rgba(8, 28, 48, 0.88);
    box-shadow: 0 0 10px rgba(68, 174, 245, 0.26);
  }

  .project-board strong {
    font-size: 7px;
    color: #ecf8ff;
  }

  .project-board span {
    font-size: 6px;
    color: #9fd1ef;
  }

  .repo-stack {
    position: absolute;
    left: 43.5%;
    top: 22.8%;
    width: 12%;
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 9;
  }

  .repo-card {
    font-size: 6px;
    color: #edf7ff;
    background: rgba(14, 30, 56, 0.87);
    border: 1px solid rgba(112, 178, 236, 0.8);
    padding: 2px 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .network-wire {
    position: absolute;
    height: 0;
    transform-origin: left center;
    z-index: 7;
  }

  .network-wire.project {
    border-top: 2px dashed rgba(105, 201, 255, 0.85);
  }

  .network-wire.runtime {
    border-top: 2px solid rgba(88, 216, 161, 0.85);
  }

  .service-node {
    position: absolute;
    z-index: 10;
    width: 15%;
    transform: translate(-50%, -64%);
    pointer-events: none;
  }

  .service-desk {
    display: block;
    width: 100%;
    image-rendering: pixelated;
    filter: drop-shadow(0 4px 5px rgba(0, 0, 0, 0.32));
  }

  .service-badge,
  .service-meta,
  .volume-chip {
    position: absolute;
    transform: skewX(-16deg);
    font-size: 6px;
    line-height: 1.3;
  }

  .service-badge {
    left: 12%;
    top: 28%;
    max-width: 58%;
    color: #f2f9ff;
    text-shadow: 1px 1px 0 #09243b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .service-meta {
    right: 10%;
    top: 58%;
    color: #c8deed;
  }

  .volume-chip {
    right: 10%;
    top: 74%;
    color: #ffe29f;
    border: 1px solid #f9ca6d;
    background: rgba(77, 52, 12, 0.58);
    padding: 1px 3px;
  }

  .service-healthy .service-badge {
    color: #9fffcb;
  }

  .service-degraded .service-badge {
    color: #ffe38d;
  }

  .service-stopped .service-badge {
    color: #ff9a9a;
  }

  .runtime-cluster {
    position: absolute;
    right: 3.5%;
    bottom: 18%;
    z-index: 9;
    padding: 5px 7px;
    border: 2px solid #5ed9a7;
    background: rgba(8, 33, 28, 0.82);
    color: #d9fff1;
    font-size: 7px;
    letter-spacing: 1px;
  }

  .build-crate {
    position: absolute;
    z-index: 11;
    width: clamp(17px, 2.2vw, 28px);
    height: clamp(14px, 1.8vw, 22px);
    transform: translate(-50%, -50%) skewX(-15deg);
    border: 2px solid #8cdfff;
    background: linear-gradient(160deg, #3ec7ff 0%, #1491d0 70%, #0f5e89 100%);
    box-shadow: inset -2px -2px 0 rgba(7, 46, 74, 0.4);
  }

  .crate-idle {
    filter: saturate(0.4) brightness(0.78);
  }

  .replica-dot {
    position: absolute;
    z-index: 12;
    width: clamp(16px, 1.8vw, 22px);
    height: clamp(16px, 1.8vw, 22px);
    transform: translate(-50%, -50%);
    border: 2px solid #7ce2ff;
    border-radius: 999px;
    background: radial-gradient(circle at 30% 25%, #67f0ff, #1082bf 72%);
    display: grid;
    place-items: center;
    color: #edf8ff;
    font-size: 6px;
    text-shadow: 1px 1px 0 #0c3552;
    box-shadow: 0 0 10px rgba(100, 220, 255, 0.28);
  }

  .replica-off {
    filter: saturate(0.35) brightness(0.76);
    border-color: #d69292;
    background: radial-gradient(circle at 30% 25%, #ffb3b3, #8b3f3f 72%);
  }

  .agent-whale {
    position: absolute;
    z-index: 13;
    width: clamp(40px, 5.5vw, 66px);
    transform: translate(-50%, -64%);
    image-rendering: pixelated;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.45));
    animation: bob 0.9s steps(2) infinite;
  }

  .agent-whale.flip {
    transform: translate(-50%, -64%) scaleX(-1);
  }

  @keyframes bob {
    0%,
    100% {
      margin-top: 0;
    }

    50% {
      margin-top: -2px;
    }
  }

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

  .zone-tag strong {
    font-size: 8px;
    color: #f2f7ff;
  }

  .zone-hosts {
    left: 3%;
    top: 3%;
  }

  .zone-images {
    left: 37%;
    top: 3%;
  }

  .zone-runtime {
    left: 73%;
    top: 3%;
  }

  .flow-strip {
    position: absolute;
    left: 53%;
    bottom: 2.8%;
    transform: translateX(-50%);
    z-index: 14;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 7px;
    letter-spacing: 1px;
    border: 2px solid #5eaef9;
    color: #f2f8ff;
    background: rgba(4, 18, 36, 0.86);
    box-shadow: 0 0 14px rgba(82, 163, 246, 0.3);
  }

  .flow-arrow {
    color: #5dd5a2;
    font-size: 8px;
  }

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

  .project-card {
    border-color: #4c7db1;
  }

  .service-card {
    border-color: #aa8f42;
  }

  .replica-card {
    border-color: #3f9f77;
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

  .meta-row strong {
    color: #ebf2ff;
    font-size: 8px;
  }

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
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    font-size: 7px;
    background: rgba(12, 19, 38, 0.92);
    border: 1px solid rgba(74, 99, 141, 0.6);
  }

  .list-row-service,
  .list-row-replica {
    grid-template-columns: 12px 1fr auto auto;
  }

  .list-row-replica.inactive {
    opacity: 0.65;
    border-color: rgba(150, 80, 80, 0.7);
  }

  .row-main,
  .row-sub,
  .row-stat {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-main {
    color: #e4edff;
  }

  .row-sub {
    color: #9cb0cb;
  }

  .row-stat {
    color: #d3ebff;
  }

  .empty-state {
    padding: 8px 6px;
    font-size: 7px;
    color: #95a8c5;
    text-align: center;
    border: 1px dashed rgba(96, 165, 250, 0.6);
    background: rgba(10, 14, 30, 0.8);
  }

  @media (max-width: 980px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }

    .zone-tag,
    .flow-strip,
    .project-zone-title {
      display: none;
    }

    .project-board {
      min-width: 16%;
    }

    .service-node {
      width: 19%;
    }
  }
</style>
