<script lang="ts">
  import { nodes, services, containers, stats, stacks } from '$lib/stores/swarm';
  import { fmtClock, createTicker, createClock } from '$lib/utils/mock.svelte';
  import Led from '../ui/Led.svelte';
  import Gauge from '../ui/Gauge.svelte';

  const tick = createTicker(900);
  const clock = createClock();

  let score = $derived($stats.runningContainers * 1000 + $stats.healthyServices * 100);

  function Sprite({ seed, color }: { seed: number, color: string }) {
    const r = (n: number) => ((seed * 7 + n * 13) % 100) / 100;
    let rects = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (r(y * 4 + x) > 0.45) {
          rects.push({ x, y: y + 1 });
        }
      }
    }
    return rects;
  }
</script>

<div class="pd-frame pd-crt" style="background: #05010a; --crt: 0.85;">
  <div class="pd-crt-screen" style="height: 100%; overflow: auto;">

    <!-- MARQUEE BAND -->
    <div style="background: linear-gradient(180deg, #2a0050 0%, #6b18a8 50%, #2a0050 100%); border-bottom: 4px solid var(--magenta); padding: 8px 0; text-align: center; color: #fff5ff; font-size: 16px; letter-spacing: 6px; text-shadow: 0 0 12px #f0abfc, 0 0 4px #fff;">
      ★ ★ ★ &nbsp; PIXDOCK ARCADE &nbsp; ★ &nbsp; FLEET ONLINE &nbsp; ★ ★ ★
    </div>

    <!-- SCOREBOARD -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 8px; background: #0a0218;">
      <div style="border: 4px solid var(--cyan); background: #000018; padding: 12px; text-align: center; box-shadow: inset 0 0 18px rgba(103, 232, 249, 0.3), 0 0 12px var(--cyan);">
        <div style="font-size: 8px; color: var(--cyan); letter-spacing: 2px; margin-bottom: 6px;">1UP · OPERATOR</div>
        <div class="pd-vt" style="font-size: 36px; color: var(--cyan); text-shadow: 0 0 14px var(--cyan), 0 0 4px #fff; letter-spacing: 2px;">
          {String(score).padStart(7, '0')}
        </div>
        <div style="font-size: 7px; color: var(--text-dim); margin-top: 4px; letter-spacing: 1px;">FLEET SCORE</div>
      </div>
      <div style="border: 4px solid var(--yellow); background: #000018; padding: 12px; text-align: center; box-shadow: inset 0 0 18px rgba(251, 191, 36, 0.3), 0 0 12px var(--yellow);">
        <div style="font-size: 8px; color: var(--yellow); letter-spacing: 2px; margin-bottom: 6px;">HI-SCORE</div>
        <div class="pd-vt" style="font-size: 36px; color: var(--yellow); text-shadow: 0 0 14px var(--yellow), 0 0 4px #fff; letter-spacing: 2px;">
          0099900
        </div>
        <div style="font-size: 7px; color: var(--text-dim); margin-top: 4px; letter-spacing: 1px;">UPTIME 47D 6H</div>
      </div>
      <div style="border: 4px solid var(--green); background: #000018; padding: 12px; text-align: center; box-shadow: inset 0 0 18px rgba(74, 222, 128, 0.3), 0 0 12px var(--green);">
        <div style="font-size: 8px; color: var(--green); letter-spacing: 2px; margin-bottom: 6px;">TIME</div>
        <div class="pd-vt" style="font-size: 36px; color: var(--green); text-shadow: 0 0 14px var(--green), 0 0 4px #fff; letter-spacing: 2px;">
          {fmtClock(clock.value)}
        </div>
        <div style="font-size: 7px; color: var(--text-dim); margin-top: 4px; letter-spacing: 1px;">SWARM · {$stats.totalNodes} NODES</div>
      </div>
    </div>

    <!-- PLAYER PANELS -->
    <div style="padding: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--magenta); text-shadow: 0 0 8px var(--magenta); letter-spacing: 3px;">★ FIGHTERS</span>
        <span style="flex: 1; height: 2px; background: linear-gradient(90deg, var(--magenta), transparent);"></span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
        {#each $nodes as n, i}
          {@const cpuHP = Math.max(0.1, 1 - Math.random() * 0.5)}
          {@const memHP = Math.max(0.1, 1 - Math.random() * 0.5)}
          {@const tone = n.role === 'manager' ? 'var(--yellow)' : i % 2 === 0 ? 'var(--cyan)' : 'var(--magenta)'}
          <div style="border: 4px solid {tone}; background: linear-gradient(180deg, rgba(0,0,30,0.9), rgba(20,0,40,0.9)); padding: 10px; box-shadow: 0 0 10px {tone}, inset 0 0 12px rgba(0,0,0,0.6); position: relative;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span style="color: {tone}; font-size: 10px; text-shadow: 0 0 6px {tone};">{n.role === 'manager' ? '★' : '●'}</span>
              <span style="font-size: 9px; color: #fff;">{n.hostname.toUpperCase()}</span>
            </div>
            
            <div style="width: 100%; aspect-ratio: 1.4; background: repeating-linear-gradient(45deg, {tone}22 0 4px, transparent 4px 8px), #000018; border: 2px solid {tone}; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 8px;">
              <svg width="56" height="40" viewBox="0 0 14 10" style="shape-rendering: crispEdges;">
                <rect x="3" y="1" width="8" height="6" fill={tone} opacity="0.85" />
                <rect x="2" y="2" width="1" height="4" fill={tone} />
                <rect x="11" y="2" width="1" height="4" fill={tone} />
                <rect x="5" y="3" width="1" height="1" fill="#000" />
                <rect x="8" y="3" width="1" height="1" fill="#000" />
                {#if (tick.value + i) % 4 !== 0}
                  <rect x="5" y="3" width="1" height="1" fill="#fff" />
                  <rect x="8" y="3" width="1" height="1" fill="#fff" />
                {/if}
                <rect x="5" y="5" width="4" height="1" fill="#000" />
                {#if n.role === 'manager'}
                  <rect x="6" y="0" width="2" height="1" fill="var(--yellow)" />
                {/if}
                <rect x="3" y="7" width="8" height="2" fill={tone} opacity="0.5" />
              </svg>
            </div>

            <div style="font-size: 7px; color: var(--text-dim); margin-bottom: 3px;">HP · CPU</div>
            <Gauge value={cpuHP} width="100%" height={12} tone={cpuHP > 0.4 ? 'ok' : 'warn'} />
            <div style="font-size: 7px; color: var(--text-dim); margin-top: 6px; margin-bottom: 3px;">MP · MEM</div>
            <Gauge value={memHP} width="100%" height={12} tone={memHP > 0.4 ? 'ok' : 'warn'} />

            <div style="margin-top: 8px; display: flex; justify-content: space-between; font-size: 7px;">
              <span style="color: var(--text-dim);">LV.???</span>
              <span style="color: var(--green);">READY</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- STAGE: STACKS -->
    <div style="padding: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--cyan); text-shadow: 0 0 8px var(--cyan); letter-spacing: 3px;">★ STAGES</span>
        <span style="flex: 1; height: 2px; background: linear-gradient(90deg, var(--cyan), transparent);"></span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        {#each Array.from($stacks.entries()) as [stack, svcs], si}
          {@const ctrs = $containers.filter(c => c.project === stack || c.stack === stack)}
          {@const ok = svcs.every(s => s.replicas_running >= s.replicas_desired)}
          <div style="border: 4px solid var(--green); background: linear-gradient(180deg, #000020, #001028); box-shadow: 0 0 12px var(--green-glow), inset 0 0 16px rgba(0,0,0,0.7);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: linear-gradient(90deg, rgba(74,222,128,0.18), transparent); border-bottom: 2px solid var(--green);">
              <span style="font-size: 11px; color: #caffd5; letter-spacing: 2px; text-shadow: 0 0 6px var(--green);">
                STAGE {si + 1} — {stack.toUpperCase()}
              </span>
              <span style="font-size: 8px; color: {ok ? 'var(--green)' : 'var(--red)'};">
                {ok ? '★ CLEAR' : 'BOSS'}
              </span>
            </div>
            <div style="padding: 10px; display: flex; flex-direction: column; gap: 6px;">
              {#each svcs as s}
                <div style="display: grid; grid-template-columns: 14px 1fr 1.4fr auto; align-items: center; gap: 10px; padding: 6px 8px; background: rgba(0,0,0,0.45); border: 2px solid #1a3a4a; font-size: 8px;">
                  <Led tone="green" />
                  <span style="color: #fff;">{s.name.toUpperCase()}</span>
                  <Gauge value={s.replicas_running} max={s.replicas_desired} width="100%" height={10} segmented segs={Math.max(s.replicas_desired, 4)} />
                  <span style="font-size: 8px; color: var(--green); text-shadow: 0 0 4px var(--green);">×{s.replicas_running}</span>
                </div>
              {/each}
              <div style="margin-top: 4px; font-size: 7px; color: var(--text-dim); text-align: right;">
                ENEMIES: {ctrs.length} CLEARED
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- CONTAINER ARMY ROW -->
    <div style="padding: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 12px; color: var(--yellow); text-shadow: 0 0 8px var(--yellow); letter-spacing: 3px;">★ ARMY ({$stats.runningContainers})</span>
        <span style="flex: 1; height: 2px; background: linear-gradient(90deg, var(--yellow), transparent);"></span>
      </div>

      <div style="background: #000018; border: 4px solid var(--yellow); padding: 10px; display: grid; grid-template-columns: repeat(11, 1fr); gap: 6px; box-shadow: 0 0 12px var(--yellow-glow), inset 0 0 14px rgba(0,0,0,0.6);">
        {#each $containers as c, i}
          {@const colors = ['var(--green)', 'var(--cyan)', 'var(--magenta)', 'var(--yellow)', 'var(--blue)']}
          {@const cCol = colors[i % colors.length]}
          <div title={c.name} style="aspect-ratio: 1; background: {i % 2 ? '#001a08' : '#001020'}; border: 2px solid var(--green); display: flex; align-items: center; justify-content: center; position: relative; animation: pd-bob 1.{i % 9}s ease-in-out infinite;">
            <svg width="28" height="28" viewBox="0 0 7 7" style="shape-rendering: crispEdges;">
              {#each Sprite({seed: i, color: cCol}) as r}
                <rect x={r.x} y={r.y} width="1" height="1" fill={cCol} />
                <rect x={6 - r.x} y={r.y} width="1" height="1" fill={cCol} />
              {/each}
            </svg>
            <span style="position: absolute; bottom: -1px; right: 1px; font-size: 6px; color: var(--yellow);">{c.id.slice(0, 4)}</span>
          </div>
        {/each}
      </div>
      <div style="margin-top: 8px; text-align: center; font-size: 9px; color: var(--magenta); letter-spacing: 3px; text-shadow: 0 0 6px var(--magenta);" class="pd-blink">
        ▶ PRESS START TO DEPLOY ◀
      </div>
    </div>
  </div>
</div>
