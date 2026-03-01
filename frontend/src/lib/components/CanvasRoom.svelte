<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { containers, dockerMode, nodes } from '$lib/stores/swarm';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let animationId: number;
  let containerWidth = 0;
  let containerHeight = window.innerHeight * 0.7; // Initially 70% of viewport height

  // Isometric Grid Config
  const T_W = 60; // Tile Width
  const T_H = 30; // Tile Height
  const COLS = 16;
  const ROWS = 16;

  function toIso(gx: number, gy: number) {
    const originX = (canvas?.width || 800) / 2;
    const originY = 80; // Start drawing down a bit
    const isoX = originX + (gx - gy) * (T_W / 2);
    const isoY = originY + (gx + gy) * (T_H / 2);
    return { x: isoX, y: isoY };
  }

  let assetsLoaded = false;
  const imgWhale = new Image();
  const imgDesk = new Image();
  const imgBookshelf = new Image();
  const imgServer = new Image();
  const imgWall = new Image();

  onMount(() => {
    // Preload images
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === 5) assetsLoaded = true;
    };
    imgWhale.onload = onLoad;
    imgDesk.onload = onLoad;
    imgBookshelf.onload = onLoad;
    imgServer.onload = onLoad;
    imgWall.onload = onLoad;
    
    imgWhale.src = '/assets/agent_whale.png';
    imgDesk.src = '/assets/new_desk.png';
    imgBookshelf.src = '/assets/new_rack.png';
    imgServer.src = '/assets/new_server.png';
    imgWall.src = '/assets/brick_wall.png';

    ctx = canvas.getContext('2d');
    loop();
  });

  // Metaphor entities
  interface Agent {
    id: string;
    gx: number;
    gy: number;
    targetGx: number;
    targetGy: number;
    state: string; // 'running', 'exited', etc.
    waitTimer: number;
    dir: 'left' | 'right' | 'up' | 'down';
    frame: number;
  }

  let agents: Map<string, Agent> = new Map();

  const COLORS = {
    bg: '#0a0a1a',
    floorGrid: '#1a1a2e',
    desk: '#1a1a2e',
    deskTop: '#252540',
    bookshelf: '#2d241e',
    bookshelfWood: '#4a3b32',
    bookColors: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
    agentBodyRunning: '#4ade80', // green
    agentBodyExited: '#ef4444', // red
    agentBodyCreated: '#fbbf24', // yellow
    agentBodyDead: '#8888aa', // gray
    eye: '#e0e0e0', // text color
    pupil: '#0a0a1a', // bg-dark
    outline: '#3a3a5c' // border
  };

  // Simple random utility
  const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

  // Sync state to agents
  $: {
    // Current valid IDs
    const currentIds = new Set();
    
    $containers.forEach(c => {
      currentIds.add(c.id);
      if (!agents.has(c.id)) {
        // Spawn new agent
        const newAgent: Agent = {
          id: c.id,
          gx: rnd(3, COLS - 2),
          gy: rnd(3, ROWS - 2),
          state: c.state,
          targetGx: 0,
          targetGy: 0,
          waitTimer: 0,
          dir: 'down',
          frame: 0
        };
        agents.set(c.id, newAgent);
        assignNewTarget(newAgent);
      } else {
        // Update state
        agents.get(c.id)!.state = c.state;
      }
    });

    // Remove obsolete agents
    for (const [id, _] of agents) {
      if (!currentIds.has(id)) {
        agents.delete(id);
      }
    }
  }

  function assignNewTarget(agent: Agent) {
    agent.targetGx = Math.floor(rnd(3, COLS - 2));
    agent.targetGy = Math.floor(rnd(3, ROWS - 2));
    agent.waitTimer = rnd(20, 150); // frames to wait at destination
    
    const dx = agent.targetGx - agent.gx;
    const dy = agent.targetGy - agent.gy;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      agent.dir = dx > 0 ? 'right' : 'left';
    } else {
      agent.dir = dy > 0 ? 'down' : 'up';
    }
  }

  function update() {
    agents.forEach(agent => {
      if (agent.state !== 'running') return; // Only running agents move
      if (!canvas) return;

      if (agent.waitTimer > 0) {
        agent.waitTimer--;
        agent.frame = 0; // standing still
        if (agent.waitTimer <= 0) {
          assignNewTarget(agent);
        }
      } else {
        const dx = agent.targetGx - agent.gx;
        const dy = agent.targetGy - agent.gy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1) {
          agent.gx = agent.targetGx;
          agent.gy = agent.targetGy;
          agent.waitTimer = rnd(60, 200);
          agent.frame = 0;
        } else {
          // Speed in logical grid units
          const speed = 0.05;
          agent.gx += (dx / dist) * speed;
          agent.gy += (dy / dist) * speed;
          
          // Animate (ticks every 15 frames approx)
          agent.frame = Math.floor(Date.now() / 150) % 2; 

          // Check dir continuous update
          if (Math.abs(dx) > Math.abs(dy)) {
             agent.dir = dx > 0 ? 'right' : 'left';
          } else {
             agent.dir = dy > 0 ? 'down' : 'up';
          }
        }
        
        // Logical Boundaries (keep inside walls)
        if (agent.gx < 3) agent.gx = 3;
        if (agent.gx > COLS - 2) agent.gx = COLS - 2;
        if (agent.gy < 3) agent.gy = 3;
        if (agent.gy > ROWS - 2) agent.gy = ROWS - 2;
      }
    });
  }

  function getAgentColor(state: string) {
    switch (state) {
      case 'running': return COLORS.agentBodyRunning;
      case 'exited': return COLORS.agentBodyExited;
      case 'created': return COLORS.agentBodyCreated;
      case 'dead': return COLORS.agentBodyDead;
      default: return '#60a5fa'; // blueprint blue
    }
  }

  function drawAgent(ctx: CanvasRenderingContext2D, agent: Agent) {
    ctx.save();
    
    const isoPos = toIso(agent.gx, agent.gy);
    ctx.translate(Math.floor(isoPos.x), Math.floor(isoPos.y));
    
    // Bobbing animation Y offset
    let bobY = 0;
    if (agent.waitTimer <= 0 && agent.frame === 1) {
       bobY = -2; // Jump up 2 pixels
    }

    // Draw shadow (isometric ellipse approximations)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bobY);

    if (agent.dir === 'right') {
        ctx.scale(-1, 1);
    }

    const w = 50; // Logical Whale Width
    const h = 50; // Logical Whale Height
    
    const bodyColor = getAgentColor(agent.state);
    
    if (agent.state !== 'running') {
       ctx.globalAlpha = 0.6;
    }
    
    // Agent rendered resting exactly on its anchor point
    ctx.drawImage(imgWhale, -w/2, -h + 6, w, h);
    ctx.globalAlpha = 1.0;
    
    if (agent.dir === 'right') {
        ctx.scale(-1, 1); 
    }

    // Label / Name
    ctx.translate(0, -bobY);
    
    const shortId = agent.id.substring(0, 4);
    const label = `${shortId}${agent.state !== 'running' ? ' [Zzz]' : ''}`;
    
    ctx.font = "8px 'Press Start 2P', monospace";
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    
    // Label Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-textWidth/2 - 2, -h - 10, textWidth + 4, 12);
    
    // Label Text
    ctx.fillStyle = bodyColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, 0, -h);

    ctx.restore();
  }

  function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.floorGrid;
    ctx.lineWidth = 1;

    for (let gx = 0; gx < COLS; gx++) {
      for (let gy = 0; gy < ROWS; gy++) {
        const {x, y} = toIso(gx, gy);
        
        ctx.beginPath();
        ctx.moveTo(x, y - T_H/2);
        ctx.lineTo(x + T_W/2, y);
        ctx.lineTo(x, y + T_H/2);
        ctx.lineTo(x - T_W/2, y);
        ctx.closePath();

        // Checkered floor pattern
        ctx.fillStyle = (gx + gy) % 2 === 0 ? '#10101d' : '#141424';
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawWalls(ctx: CanvasRenderingContext2D, renderQueue: {depth: number, render: () => void}[]) {
    const wallW = 80; 
    const wallH = 140; 
    
    // Left Wall (gx = 2, gy varies 2..ROWS-1)
    for(let i = 2; i < ROWS - 1; i++) {
        const gx = 2; 
        const gy = i;
        const pos = toIso(gx, gy);
        
        renderQueue.push({
            depth: gx + gy - 0.2, // Slightly behind center of tile
            render: () => {
                ctx.save();
                ctx.translate(Math.floor(pos.x), Math.floor(pos.y));

                // Wall Sprite (Left Wall faces South-East, original image orientation)
                ctx.drawImage(imgWall, -wallW/2, -wallH + T_H/2 + 10, wallW, wallH);
                ctx.restore();
            }
        });
    }

    // Right Wall (gx varies 2..COLS-1, gy = 2)
    for(let i = 3; i < COLS - 1; i++) {
        const gx = i; 
        const gy = 2;
        const pos = toIso(gx, gy);
        
        renderQueue.push({
            depth: gx + gy - 0.2, 
            render: () => {
                ctx.save();
                ctx.translate(Math.floor(pos.x), Math.floor(pos.y));

                // Right Wall faces South-West, flip horizontally
                ctx.scale(-1, 1);
                ctx.drawImage(imgWall, -wallW/2, -wallH + T_H/2 + 10, wallW, wallH);
                ctx.restore();
            }
        });
    }
  }

  function drawServerUnits(ctx: CanvasRenderingContext2D, renderQueue: {depth: number, render: () => void}[]) {
      // Place Servers behind the left brick wall (gx = 0, gy = 3..14)
      const serverW = 90;
      const serverH = 150;
      
      for(let i = 3; i < ROWS - 2; i += 2) {
          const gx = 0;
          const gy = i;
          const pos = toIso(gx, gy);

          renderQueue.push({
              depth: gx + gy, // Isometric Depth Sorting (Will be smaller than wall's depth, rendering behind)
              render: () => {
                  ctx.save();
                  ctx.translate(Math.floor(pos.x), Math.floor(pos.y));
                  
                  // Big Server Unit
                  ctx.globalAlpha = 0.5; // Dimmed because it's behind the wall, or we keep it lit. Let's keep it lit.
                  ctx.globalAlpha = 1.0;
                  ctx.drawImage(imgServer, -serverW/2, -serverH + T_H, serverW, serverH);
                  
                  ctx.restore();
              }
          });
      }
  }

  function drawDesks(ctx: CanvasRenderingContext2D, renderQueue: {depth: number, render: () => void}[]) {
    const numNodes = $dockerMode === 'swarm' ? Math.max(1, $nodes.length) : 1;
    
    const deskW = 120; // Logical Desk Width (Enlarged to match illustration scaling)
    const deskH = 120; // Logical Desk Height
    
    // We will place desks in the middle area (gx: 6-10, gy: 6-10) to be well inside the walls
    const maxDesksPerRow = Math.floor((COLS - 6) / 4);
    
    for(let i=0; i<numNodes; i++) {
        const row = Math.floor(i / maxDesksPerRow);
        const col = i % maxDesksPerRow;
        
        const gx = 6 + (col * 4);
        const gy = 6 + (row * 4);
        const nodeName = $dockerMode === 'swarm' && $nodes[i] ? $nodes[i].hostname : "LOCAL HOST";

        const pos = toIso(gx, gy);

        renderQueue.push({
            depth: gx + gy, // Isometric Depth
            render: () => {
                ctx.save();
                ctx.translate(Math.floor(pos.x), Math.floor(pos.y));
                
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(0, T_H/4, deskW/3, deskW/6, 0, 0, Math.PI*2);
                ctx.fill();

                // Desk Sprite
                ctx.drawImage(imgDesk, -deskW/2 + 5, -deskH + T_H/2 + 10, deskW, deskH);

                // Draw Server details label below the desk
                ctx.fillStyle = COLORS.eye;
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(`[${nodeName.substring(0,8)}]`, 5, T_H/2 + 12);

                ctx.restore();
            }
        });
    }
  }

  function render() {
    if (!ctx || !canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      // Ensure height is at least 70vh dynamically
      const targetHeight = window.innerHeight * 0.7;
      
      if (rect.width !== canvas.width || targetHeight !== canvas.height) {
        canvas.width = rect.width;
        canvas.height = targetHeight;
        containerWidth = rect.width;
        containerHeight = targetHeight;
      }
    }

    // High Res Images look better when smoothed down
    ctx.imageSmoothingEnabled = true;

    // Background and Floors
    drawFloor(ctx, canvas.width, canvas.height);
    
    if (!assetsLoaded) return; // Wait for sprites to load

    const renderQueue: {depth: number, render: () => void}[] = [];

    // Main Server Rack Units (Placed Behind Left Wall)
    drawServerUnits(ctx, renderQueue);

    // Walls
    drawWalls(ctx, renderQueue);

    // Nodes as Desks (Inside room)
    drawDesks(ctx, renderQueue);

    // Agents (Containers)
    agents.forEach(agent => {
      renderQueue.push({
          depth: agent.gx + agent.gy, // Isometric Depth Sorting
          render: () => drawAgent(ctx!, agent)
      });
    });

    // Execute Z-Sorted Render Queue based on Depth
    renderQueue.sort((a, b) => a.depth - b.depth).forEach(item => item.render());
  }

  function loop() {
    update();
    render();
    animationId = requestAnimationFrame(loop);
  }

  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
</script>

<div class="canvas-container pixel-border">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .canvas-container {
    width: 100%;
    min-height: 70vh;
    height: 70vh;
    background: var(--bg-dark);
    position: relative;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
