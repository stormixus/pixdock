<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { containers, dockerMode, nodes } from '$lib/stores/swarm';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let animationId: number;
  let containerWidth = 0;
  let containerHeight = window.innerHeight * 0.7; // 70% of viewport height

  // Isometric Grid Config (for agents)
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

  // Assets
  let assetsLoaded = false;
  const imgWhale = new Image();
  const imgBg = new Image();

  onMount(() => {
    // Preload images
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === 2) assetsLoaded = true;
    };
    imgWhale.onload = onLoad;
    imgBg.onload = onLoad;
    
    imgWhale.src = '/assets/agent_whale.png';
    imgBg.src = '/assets/server_room_bg.jpg';

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
          gx: rnd(1, COLS - 1),
          gy: rnd(1, ROWS - 1),
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
    agent.targetGx = Math.floor(rnd(1, COLS - 1));
    agent.targetGy = Math.floor(rnd(1, ROWS - 1));
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
        
        // Logical Boundaries
        if (agent.gx < 0) agent.gx = 0;
        if (agent.gx > COLS - 1) agent.gx = COLS - 1;
        if (agent.gy < 0) agent.gy = 0;
        if (agent.gy > ROWS - 1) agent.gy = ROWS - 1;
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

  function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!imgBg.complete || imgBg.width === 0) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    
    // Scale image to COVER the canvas
    const imgRatio = imgBg.width / imgBg.height;
    const canvasRatio = width / height;
    
    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (canvasRatio > imgRatio) {
       drawH = width / imgRatio;
       offsetY = (height - drawH) / 2;
    } else {
       drawW = height * imgRatio;
       offsetX = (width - drawW) / 2;
    }
    
    ctx.drawImage(imgBg, offsetX, offsetY, drawW, drawH);
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

    // Background
    drawBackground(ctx, canvas.width, canvas.height);
    
    if (!assetsLoaded) return; // Wait for sprites to load

    const renderQueue: {depth: number, render: () => void}[] = [];

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
