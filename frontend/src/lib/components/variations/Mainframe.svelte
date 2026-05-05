<script lang="ts">
  import { nodes, services, containers, stats } from '$lib/stores/swarm';
  import { fmtClock, fmtDate, createClock } from '$lib/utils/mock.svelte';

  const clock = createClock();
  const amber = '#ffb000';
  const dim = '#a87300';
  const faint = '#5a3a00';
  
  let EVENTS = [
    { t: '12:04', lvl: 'OK', msg: 'System initialized' },
    { t: '12:05', lvl: 'WARN', msg: 'High CPU on worker-01' }
  ];
</script>

{#snippet Banner({ color, text, sub }: { color: string, text: string, sub: string })}
  <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed {color}; padding: 2px 4px; margin-bottom: 4px;">
    <span style="color: {color}; text-shadow: 0 0 6px {color}; letter-spacing: 1px;">━━ {text} ━━</span>
    <span style="color: #a87300;">{sub}</span>
  </div>
{/snippet}

{#snippet Hd({ cols, widths, dimColor }: { cols: string[], widths: number[], dimColor: string })}
  <div style="display: grid; grid-template-columns: {widths.map(w => `${w}fr`).join(' ')}; gap: 8px; color: {dimColor}; border-bottom: 1px dashed {dimColor}; padding-bottom: 2px; margin-bottom: 2px; letter-spacing: 1px;">
    {#each cols as c}<span>{c}</span>{/each}
  </div>
{/snippet}

{#snippet Cell({ cols, widths, amberColor }: { cols: any[], widths: number[], amberColor: string })}
  <div style="display: grid; grid-template-columns: {widths.map(w => `${w}fr`).join(' ')}; gap: 8px; padding: 1px 0; color: {amberColor};">
    {#each cols as c}
      <span style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        {#if typeof c === 'string' || typeof c === 'number'}{c}{:else}
          <!-- Render HTML strings safely since some are spans -->
          {@html c}
        {/if}
      </span>
    {/each}
  </div>
{/snippet}

<div class="pd-frame pd-crt" style="background: #0a0500; color: {amber}; --crt: 0.7;">
  <div class="pd-crt-screen pd-vt" style="height: 100%; overflow: auto; padding: 12px; font-size: 16px; line-height: 1.15;">

    <!-- ASCII HEADER -->
    <pre style="color: {amber}; margin: 0; text-shadow: 0 0 6px {amber}; font-size: 14px; line-height: 1.05;">{`
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║  PIXDOCK / MAINFRAME 0.2.0   ·   TERMINAL 01   ·   ${fmtDate(clock.value)}   ${fmtClock(clock.value)}   ·   USR: ROOT   ·   SWARM ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝`}</pre>

    <!-- TOP STATUS LINE -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; border: 1px solid {dim}; margin-top: 8px;">
      {#each [
        ['NODES', `${$stats.readyNodes}/${$stats.totalNodes}`],
        ['SVCS',  `${$stats.healthyServices}/${$stats.totalServices}`],
        ['TASKS', `${$stats.runningContainers}/${$stats.totalContainers}`],
        ['REPL',  `?/?`],
        ['IMG',   `?`],
        ['CPU',   `42%`],
        ['MEM',   `58%`],
      ] as [k, v], i}
        <div style="padding: 6px 10px; border-right: {i < 6 ? `1px solid ${faint}` : 'none'}; display: flex; justify-content: space-between;">
          <span style="color: {dim};">{k}</span>
          <span style="color: {amber}; text-shadow: 0 0 5px {amber};">{v}</span>
        </div>
      {/each}
    </div>

    <!-- TWO-COLUMN: NODE TABLE + SERVICE TABLE -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
      <div>
        {@render Banner({ color: amber, text: "NODE.TABLE", sub: `${$nodes.length} ROWS` })}
        <div style="border: 1px solid {dim}; padding: 4px 8px;">
          {@render Hd({ cols: ['HOST', 'IP', 'ROLE', 'CPU', 'MEM', 'UP'], widths: [2.1, 1.7, 0.9, 1, 1, 1], dimColor: dim })}
          {#each $nodes as n}
            {@render Cell({
              cols: [
                `<span style="color: ${amber}">●</span> ${n.hostname}`,
                n.ip,
                n.role.toUpperCase(),
                `24%`,
                `12/32G`,
                `UP`,
              ],
              widths: [2.1, 1.7, 0.9, 1, 1, 1],
              amberColor: amber
            })}
          {/each}
        </div>
      </div>

      <div>
        {@render Banner({ color: amber, text: "SERVICE.TABLE", sub: `${$services.length} ROWS` })}
        <div style="border: 1px solid {dim}; padding: 4px 8px;">
          {@render Hd({ cols: ['STACK', 'NAME', 'IMG', 'REPL', 'PORT'], widths: [1, 1.3, 2, 0.9, 0.9], dimColor: dim })}
          {#each $services as s}
            {@render Cell({
              cols: [
                s.stack || '-',
                s.name,
                s.image.split(':')[0].split('/').slice(-1)[0],
                `${s.replicas_running}/${s.replicas_desired}`,
                (s.ports || []).map((p: any) => p.published).join(','),
              ],
              widths: [1, 1.3, 2, 0.9, 0.9],
              amberColor: amber
            })}
          {/each}
        </div>
      </div>
    </div>

    <!-- CONTAINER MEGA-TABLE -->
    <div style="margin-top: 14px;">
      {@render Banner({ color: amber, text: "TASK.TABLE", sub: `${$containers.length} ROWS · FILTER: ALL` })}
      <div style="border: 1px solid {dim}; padding: 4px 8px;">
        {@render Hd({ cols: ['ID', 'NAME', 'STACK', 'IMAGE', 'NODE', 'STATE', 'CPU%', 'MEMMB', 'UP'], widths: [0.6, 2.2, 0.9, 2.4, 1.1, 0.9, 0.7, 0.8, 0.7], dimColor: dim })}
        {#each $containers as c}
          {@render Cell({
            cols: [
              c.id.slice(0, 8),
              c.name,
              c.project || c.stack || '-',
              c.image.split('@')[0],
              c.node || 'local',
              `<span style="color: ${amber}; text-shadow: 0 0 4px ${amber}">${c.state.toUpperCase()}</span>`,
              '0',
              '0',
              'UP',
            ],
            widths: [0.6, 2.2, 0.9, 2.4, 1.1, 0.9, 0.7, 0.8, 0.7],
            amberColor: amber
          })}
        {/each}
      </div>
    </div>

    <!-- ASCII BAR CHART -->
    <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        {@render Banner({ color: amber, text: "LOAD.BY.NODE", sub: "REAL-TIME" })}
        <div style="border: 1px solid {dim}; padding: 8px;">
          {#each $nodes as n}
            <div style="display: grid; grid-template-columns: 120px 1fr 50px; align-items: center; gap: 6px; padding: 2px 0;">
              <span>{n.hostname}</span>
              <span style="color: {amber};">
                {'█'.repeat(Math.max(1, Math.round(0.4 * 32)))}
                <span style="color: {faint};">{'░'.repeat(Math.max(0, 32 - Math.round(0.4 * 32)))}</span>
              </span>
              <span style="color: {dim}; text-align: right;">40%</span>
            </div>
          {/each}
        </div>
      </div>

      <div>
        {@render Banner({ color: amber, text: "EVENT.STREAM", sub: "TAIL -F" })}
        <div style="border: 1px solid {dim}; padding: 8px; height: 100%;">
          {#each EVENTS as e, i}
            <div style="padding: 1px 0;">
              <span style="color: {faint};">{e.t}</span>{' '}
              <span style="color: {e.lvl === 'OK' ? amber : dim}; text-shadow: {e.lvl === 'OK' ? `0 0 4px ${amber}` : 'none'};">[{e.lvl}]</span>{' '}
              <span>{e.msg}</span>
            </div>
          {/each}
          <div style="color: {amber}; text-shadow: 0 0 6px {amber};" class="pd-blink">▮</div>
        </div>
      </div>
    </div>

    <!-- COMMAND LINE -->
    <div style="margin-top: 14px; border: 1px solid {dim}; padding: 8px; display: flex; align-items: center; gap: 8px;">
      <span style="color: {amber}; text-shadow: 0 0 4px {amber};">pixdock@swarm:~$</span>
      <span style="color: {amber};">docker service ls --filter mode=replicated</span>
      <span style="color: {amber};" class="pd-blink">█</span>
      <span style="margin-left: auto; color: {dim}; font-size: 14px;">F1 HELP · F3 STOP · F5 REFRESH · F10 EXIT</span>
    </div>
  </div>
</div>
