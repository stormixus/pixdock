<script lang="ts">
  import { nodes, services, containers, stats, connectionStatus, dockerMode } from '$lib/stores/swarm';
  import { spark, fmtClock, createTicker, createClock } from '$lib/utils/mock.svelte';
  import Led from '../ui/Led.svelte';
  import Gauge from '../ui/Gauge.svelte';
  import Sparkline from '../ui/Sparkline.svelte';
  import Bars from '../ui/Bars.svelte';

  const tick = createTicker(1500);
  const clock = createClock();

  let hot = $state('');

  $effect(() => {
    if (!hot && $containers.length > 0) {
      hot = $containers[0].name;
    }
  });

  let hotContainer = $derived($containers.find(c => c.name === hot));
  let EVENTS = [{ t: '12:04', lvl: 'OK', msg: 'System initialized' }, { t: '12:05', lvl: 'WARN', msg: 'High CPU on worker-01' }];
</script>

<div class="pd-frame pd-crt" style="background: #040810;">
  <div class="pd-crt-screen" style="height: 100%; display: flex; flex-direction: column;">
    <!-- TOP COMMAND BAR -->
    <div style="display: flex; align-items: stretch; border-bottom: 4px solid var(--border); background: linear-gradient(180deg, #0a1024, #060a18);">
      <div style="padding: 10px 14px; border-right: 2px solid var(--border); display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--text-dim); font-size: 14px;">[</span>
        <span style="color: var(--blue); font-size: 11px; text-shadow: 0 0 8px var(--blue-glow);">PX</span>
        <span style="color: var(--text-dim); font-size: 14px;">]</span>
        <span style="font-size: 12px; letter-spacing: 2px;">COMMAND</span>
      </div>

      <div style="flex: 1; display: grid; grid-template-columns: repeat(8, 1fr); border-right: 2px solid var(--border);">
        {#each [
          { l: 'MODE', v: $dockerMode.toUpperCase(), c: 'var(--yellow)' },
          { l: 'NODES', v: `${$stats.readyNodes}/${$stats.totalNodes}`, c: 'var(--green)' },
          { l: 'SVCS', v: `${$stats.healthyServices}/${$stats.totalServices}`, c: 'var(--green)' },
          { l: 'CTR', v: `${$stats.runningContainers}/${$stats.totalContainers}`, c: 'var(--green)' },
          { l: 'REPL', v: `?`, c: 'var(--cyan)' },
          { l: 'CPU', v: `42%`, c: 'var(--blue)' },
          { l: 'MEM', v: `58%`, c: 'var(--purple)' },
          { l: 'IMG', v: '?', c: 'var(--magenta)' },
        ] as t}
          <div style="padding: 6px 10px; border-right: 1px dashed var(--border); display: flex; flex-direction: column; justify-content: center; gap: 2px;">
            <span style="font-size: 6px; color: var(--text-dim); letter-spacing: 1px;">{t.l}</span>
            <span style="font-size: 13px; color: {t.c}; text-shadow: 0 0 6px {t.c};">{t.v}</span>
          </div>
        {/each}
      </div>

      <div style="padding: 10px 14px; display: flex; align-items: center; gap: 12px;">
        <span style="display: flex; gap: 6px; align-items: center; font-size: 8px;">
          <Led tone={$connectionStatus === 'connected' ? 'green' : 'red'} blink={$connectionStatus === 'connecting'} /> WS LINK
        </span>
        <span class="pd-vt" style="font-size: 18px; color: var(--green); text-shadow: 0 0 6px var(--green-glow);">{fmtClock(clock.value)}</span>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div style="flex: 1; display: grid; grid-template-columns: 300px 1fr 320px; grid-template-rows: 1fr 220px; gap: 6px; padding: 6px; min-height: 0;">

      <!-- LEFT: NODES -->
      <div class="pd-pixel-border" style="padding: 10px; grid-row: 1 / 2; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;">
          <span style="font-size: 8px; color: var(--blue); letter-spacing: 2px;">◆ NODES</span>
          <span style="font-size: 7px; color: var(--text-dim); letter-spacing: 1px;">{$stats.readyNodes}/{$stats.totalNodes}</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: auto; padding-right: 2px;">
          {#each $nodes as n}
            <div style="background: var(--bg-dark); border: 2px solid var(--border); padding: 8px;">
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                <Led tone={n.status === 'ready' ? 'green' : 'red'} blink={n.status !== 'ready'} />
                <span style="font-size: 9px;">{n.hostname}</span>
                <span style="margin-left: auto; font-size: 8px; color: {n.role === 'manager' ? 'var(--yellow)' : 'var(--text-dim)'};">
                  {n.role === 'manager' ? '★ MGR' : '● WRK'}
                </span>
              </div>
              <div style="font-size: 7px; color: var(--text-dim); margin-bottom: 5px;">{n.ip} · {n.availability}</div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                <span style="font-size: 7px; color: var(--text-dim); width: 26px;">CPU</span>
                <Gauge value={Math.random()} width={140} segmented segs={14} />
                <span style="font-size: 7px; color: var(--text); margin-left: auto;">...</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- CENTER: SERVICES MATRIX -->
      <div class="pd-pixel-border" style="padding: 10px; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;">
          <span style="font-size: 8px; color: var(--green); letter-spacing: 2px;">◆ SERVICE MATRIX</span>
          <span style="font-size: 7px; color: var(--text-dim); letter-spacing: 1px;">{$stats.healthyServices}/{$stats.totalServices} HEALTHY</span>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; gap: 0; overflow: auto;">
          <div style="display: grid; grid-template-columns: 120px repeat(5, 1fr); font-size: 6px; color: var(--text-dim); border-bottom: 1px dashed var(--border); padding-bottom: 4px; margin-bottom: 4px; letter-spacing: 1px;">
            <span>SERVICE</span>
            {#each $nodes as n}
              <span style="text-align: center;">{n.hostname.replace('-0', '·')}</span>
            {/each}
          </div>
          {#each $services as svc}
            <div style="display: grid; grid-template-columns: 120px repeat(5, 1fr); align-items: center; padding: 5px 0; border-bottom: 1px dotted rgba(58,58,92,0.5); font-size: 8px;">
              <span style="display: flex; align-items: center; gap: 5px;">
                <Led tone="green" size="sm" />
                <span style="color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{svc.name}</span>
              </span>
              {#each $nodes as n}
                <div style="text-align: center; display: flex; justify-content: center; gap: 2px;">
                  <span style="color: var(--text-faint); font-size: 8px;">·</span>
                </div>
              {/each}
            </div>
          {/each}
        </div>

        <div style="border-top: 2px solid var(--border); margin-top: 6px; padding-top: 8px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          {#each [
            { l: 'REQ/S', c: 'var(--green)', v: 1842, d: spark(11 + tick.value, 28, 0.6, 0.3) },
            { l: 'CPU%',  c: 'var(--blue)',  v: 41,   d: spark(22 + tick.value, 28, 0.42, 0.2) },
            { l: 'MEM%',  c: 'var(--purple)',v: 38,   d: spark(33 + tick.value, 28, 0.4, 0.15) },
            { l: 'NET MB',c: 'var(--cyan)',  v: 124,  d: spark(44 + tick.value, 28, 0.5, 0.4) },
          ] as s}
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="display: flex; justify-content: space-between; font-size: 6px; color: var(--text-dim);">
                <span>{s.l}</span>
                <span style="color: {s.c}; font-size: 8px;">{s.v}</span>
              </div>
              <Sparkline data={s.d} width={140} height={20} color={s.c} fill />
            </div>
          {/each}
        </div>
      </div>

      <!-- RIGHT: TARGET INSPECTOR -->
      <div class="pd-pixel-border" style="padding: 10px; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;">
          <span style="font-size: 8px; color: var(--yellow); letter-spacing: 2px;">◆ TARGET</span>
          <span style="font-size: 7px; color: var(--text-dim); letter-spacing: 1px;">{hot}</span>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px; font-size: 8px; overflow: auto;">
          {#if hotContainer}
            <div style="background: var(--bg-dark); padding: 8px; border: 2px solid var(--border); display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 7px;">
                <span style="color: var(--text-dim);">ID</span><span style="color: var(--text);">{hotContainer.id.slice(0, 8)}…</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 7px;">
                <span style="color: var(--text-dim);">IMAGE</span><span style="color: var(--text);">{hotContainer.image}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 7px;">
                <span style="color: var(--text-dim);">NODE</span><span style="color: var(--text);">{hotContainer.node || 'local'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 7px;">
                <span style="color: var(--text-dim);">STATE</span><span style="color: {hotContainer.state === 'running' ? 'var(--green)' : 'var(--red)'};">{hotContainer.state.toUpperCase()}</span>
              </div>
            </div>

            <div style="background: var(--bg-dark); padding: 8px; border: 2px solid var(--border);">
              <div style="font-size: 7px; color: var(--text-dim); margin-bottom: 4px;">CPU</div>
              <Bars data={spark(91 + tick.value, 22, 0.3, 0.3)} width={260} height={28} color="var(--blue)" />
            </div>
            <div style="background: var(--bg-dark); padding: 8px; border: 2px solid var(--border);">
              <div style="font-size: 7px; color: var(--text-dim); margin-bottom: 4px;">MEM</div>
              <Bars data={spark(108 + tick.value, 22, 0.6, 0.1)} width={260} height={28} color="var(--purple)" />
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: auto;">
              {#each [
                { i: '≡', t: 'LOGS', c: 'blue' },
                { i: '↻', t: 'RESTART', c: 'yellow' },
                { i: '■', t: 'STOP', c: 'red' },
                { i: '⊕', t: 'EXEC', c: 'green' },
              ] as b}
                <button style="background: var(--bg-panel); border: 2px solid var(--{b.c}); color: var(--{b.c}); font-size: 7px; padding: 8px 4px; letter-spacing: 1px;">{b.i} {b.t}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- BOTTOM-LEFT: CONTAINER LIST -->
      <div class="pd-pixel-border" style="padding: 10px; grid-column: 1 / 3; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;">
          <span style="font-size: 8px; color: var(--green); letter-spacing: 2px;">◆ TASK ROSTER</span>
          <span style="font-size: 7px; color: var(--text-dim); letter-spacing: 1px;">{$stats.runningContainers} RUNNING</span>
        </div>
        <div style="flex: 1; overflow: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; align-content: start; column-gap: 8px; row-gap: 0;">
          {#each $containers as c}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              onclick={() => hot = c.name}
              style="display: grid; grid-template-columns: 12px 1.4fr 1fr 36px 36px; align-items: center; gap: 8px; padding: 4px 6px; font-size: 7px; background: {hot === c.name ? 'var(--bg-panel-light)' : 'transparent'}; border-left: {hot === c.name ? '2px solid var(--blue)' : '2px solid transparent'}; cursor: pointer; border-bottom: 1px dotted rgba(58,58,92,0.5);"
            >
              <Led tone="green" size="sm" />
              <span style="color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{c.name}</span>
              <span style="color: var(--text-dim);">{c.node || 'local'}</span>
              <span style="color: var(--blue); text-align: right;">0%</span>
              <span style="color: var(--purple); text-align: right;">0M</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- BOTTOM-RIGHT: EVENT LOG -->
      <div class="pd-pixel-border" style="padding: 10px; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;">
          <span style="font-size: 8px; color: var(--purple); letter-spacing: 2px;">◆ EVENT LOG</span>
          <span style="font-size: 7px; color: var(--text-dim); letter-spacing: 1px;">LIVE</span>
        </div>
        <div class="pd-mono" style="flex: 1; overflow: auto; font-size: 9px; line-height: 1.5;">
          {#each EVENTS as e}
            <div style="display: flex; gap: 6px; padding: 2px 0;">
              <span style="color: var(--text-faint);">{e.t}</span>
              <span style="color: {e.lvl === 'OK' ? 'var(--green)' : 'var(--blue)'}; width: 28px;">{e.lvl}</span>
              <span style="color: var(--text);">{e.msg}</span>
            </div>
          {/each}
        </div>
      </div>

    </div>
  </div>
</div>
