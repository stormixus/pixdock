<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { containers, dockerMode, nodes } from '$lib/stores/swarm';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null;
  let animationId: number;
  let containerWidth = 0;
  let containerHeight = 300; // Fixed initial height

  // Assets
  let assetsLoaded = false;
  const imgWhale = new Image();
  const imgDesk = new Image();
  const imgBookshelf = new Image();

  onMount(() => {
    // Preload images
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === 3) assetsLoaded = true;
    };
    imgWhale.onload = onLoad;
    imgDesk.onload = onLoad;
    imgBookshelf.onload = onLoad;
    
    imgWhale.src = '/assets/agent_whale.png';
    imgDesk.src = '/assets/node_desk.png';
    imgBookshelf.src = '/assets/bookshelf.png';

    ctx = canvas.getContext('2d');
    loop();
  });

  // Metaphor entities
  interface Agent {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    state: string; // 'running', 'exited', etc.
    targetX: number;
    targetY: number;
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
          x: rnd(20, (canvas?.width || 600) - 20),
          y: rnd(70, containerHeight - 20),
          vx: 0,
          vy: 0,
          state: c.state,
          targetX: 0,
          targetY: 0,
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
    if (!canvas) return;
    agent.targetX = rnd(20, canvas.width - 20);
    agent.targetY = rnd(20, canvas.height - 20);
    agent.waitTimer = rnd(20, 150); // frames to wait at destination
    
    const dx = agent.targetX - agent.x;
    const dy = agent.targetY - agent.y;
    
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
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          agent.x = agent.targetX;
          agent.y = agent.targetY;
          agent.waitTimer = rnd(60, 200);
          agent.frame = 0;
        } else {
          const speed = 0.8;
          agent.x += (dx / dist) * speed;
          agent.y += (dy / dist) * speed;
          
          // Animate (ticks every 15 frames approx)
          agent.frame = Math.floor(Date.now() / 150) % 2; 

          // Check dir continuous update
          if (Math.abs(dx) > Math.abs(dy)) {
             agent.dir = dx > 0 ? 'right' : 'left';
          } else {
             agent.dir = dy > 0 ? 'down' : 'up';
          }
        }
        
        // Boundaries
        if (agent.x < 10) agent.x = 10;
        if (agent.x > canvas.width - 10) agent.x = canvas.width - 10;
        if (agent.y < 80) agent.y = 80; // Keep off top walls & bookshelves
        if (agent.y > canvas.height - 10) agent.y = canvas.height - 10;
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
    
    // Draw directly from integer positions to maintain crispness
    const px = Math.floor(agent.x);
    const py = Math.floor(agent.y);
    ctx.translate(px, py);
    
    const s = 4; // pixel scale match approximately
    
    // Bobbing animation Y offset
    let bobY = 0;
    if (agent.waitTimer <= 0 && agent.frame === 1) {
       bobY = -2; // Jump up 2 pixels
    }

    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-10, 10, 20, 6);

    ctx.translate(0, bobY);

    // If facing right, flip the image horizontally because our whale sprite faces left/neutral
    if (agent.dir === 'right') {
        ctx.scale(-1, 1);
    }

    // Draw Whale Sprite (centered)
    // The sprite bounding box needs to be centered around 0,0
    const w = imgWhale.width;
    const h = imgWhale.height;
    
    // Tint color based on state using globalCompositeOperation
    const bodyColor = getAgentColor(agent.state);
    
    if (agent.state !== 'running') {
       // Optional: Add simple color tint/grayscale if not running
       // For now, let's just make non-running agents slightly translucent
       ctx.globalAlpha = 0.6;
    }
    
    ctx.drawImage(imgWhale, -w/2, -h/2, w, h);
    ctx.globalAlpha = 1.0;
    
    if (agent.dir === 'right') {
        ctx.scale(-1, 1); // restore scale axis
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
    ctx.fillRect(-textWidth/2 - 2, -h/2 - 14, textWidth + 4, 12);
    
    // Label Text
    ctx.fillStyle = bodyColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, 0, -h/2 - 4);

    ctx.restore();
  }

  function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.floorGrid;
    ctx.lineWidth = 2;
    const tileSize = 32;
    
    ctx.beginPath();
    for (let x = 0; x <= width; x += tileSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += tileSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  function drawBookshelves(ctx: CanvasRenderingContext2D, width: number, renderQueue: {y: number, render: () => void}[]) {
    const shelfW = imgBookshelf.width || 64;
    const shelfH = imgBookshelf.height || 64;
    const numShelves = Math.floor(width / shelfW); // Fill top wall

    for(let i=0; i<numShelves; i++) {
        const x = i * shelfW;
        const y = 0; // Top edge
        
        renderQueue.push({
            y: y + shelfH, // Sort by bottom of the bookshelf
            render: () => {
                ctx.save();
                ctx.translate(x, y);

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(0, shelfH - 10, shelfW, 12);

                // Bookshelf Sprite
                ctx.drawImage(imgBookshelf, 0, 0, shelfW, shelfH);

                ctx.restore();
            }
        });
    }
  }

  function drawDesks(ctx: CanvasRenderingContext2D, width: number, renderQueue: {y: number, render: () => void}[]) {
    const numNodes = $dockerMode === 'swarm' ? Math.max(1, $nodes.length) : 1;
    
    const deskW = imgDesk.width || 80;
    const deskH = imgDesk.height || 80;
    const padding = 20;

    let currentX = padding;
    let currentY = 100 + padding; // Below bookshelves

    for(let i=0; i<numNodes; i++) {
        const x = currentX;
        const y = currentY;
        const nodeName = $dockerMode === 'swarm' && $nodes[i] ? $nodes[i].hostname : "LOCAL HOST";

        renderQueue.push({
            y: y + deskH, // Sort by bottom of desk
            render: () => {
                ctx.save();
                
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(x + 10, y + deskH - 20, deskW - 20, 20);

                // Desk Sprite
                ctx.drawImage(imgDesk, x, y, deskW, deskH);

                // Draw Server details label
                ctx.fillStyle = COLORS.eye;
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(`[${nodeName.substring(0,8)}]`, x + deskW/2, y + deskH);

                ctx.restore();
            }
        });

        currentX += deskW + padding * 2;
        if (currentX + deskW > width) {
            currentX = padding;
            currentY += deskH + padding * 2;
        }
    }
  }

  function render() {
    if (!ctx || !canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      if (rect.width !== canvas.width || containerHeight !== canvas.height) {
        canvas.width = rect.width;
        canvas.height = containerHeight;
        containerWidth = rect.width;
      }
    }

    // Reset Context smoothing each frame to be safe
    ctx.imageSmoothingEnabled = false;

    // Background and Floors
    drawFloor(ctx, canvas.width, canvas.height);
    
    if (!assetsLoaded) return; // Wait for sprites to load

    const renderQueue: {y: number, render: () => void}[] = [];

    // Bookshelves (Images)
    drawBookshelves(ctx, canvas.width, renderQueue);

    // Nodes as Desks
    drawDesks(ctx, canvas.width, renderQueue);

    // Agents (Containers)
    agents.forEach(agent => {
      renderQueue.push({
          y: agent.y, // Sort by bottom of agent
          render: () => drawAgent(ctx!, agent)
      });
    });

    // Execute Z-Sorted Render Queue
    renderQueue.sort((a, b) => a.y - b.y).forEach(item => item.render());
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
    height: 300px;
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
