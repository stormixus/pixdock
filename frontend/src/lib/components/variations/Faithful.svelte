<script lang="ts">
  import { stacks, nodes, services, containers, stats, connectionStatus, dockerMode } from '$lib/stores/swarm';
  import { logout } from '$lib/stores/auth';
  import { spark, fmtClock, stateLed, createTicker, createClock } from '$lib/utils/mock.svelte';
  import Led from '../ui/Led.svelte';
  import Gauge from '../ui/Gauge.svelte';
  import Sparkline from '../ui/Sparkline.svelte';
  import ActionBtn from '../ui/ActionBtn.svelte';

  const tick = createTicker(2000);
  const clock = createClock();

  let filter = $state('ALL');
  let search = $state('');
  let sel = $state<string | null>(null);

  let filteredContainers = $derived($containers.filter(c => {
    const m1 = filter === 'ALL' || (filter === 'RUNNING' && c.state === 'running');
    const m2 = !search || c.name.includes(search) || c.image.includes(search);
    return m1 && m2;
  }));

  let groupedContainers = $derived(() => {
    const m = new Map<string, typeof filteredContainers>();
    filteredContainers.forEach(c => {
      const stack = c.project ?? '_standalone';
      if (!m.has(stack)) m.set(stack, []);
      m.get(stack)!.push(c);
    });
    return Array.from(m.entries());
  });

  function handleLogout() {
    logout();
  }
</script>

<div class="pd-frame pd-crt">
  <div class="pd-crt-screen" style="height: 100%; overflow: auto; background: var(--bg-dark);">
    <!-- HEADER -->
    <header class="pd-pixel-border" style="margin: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
      <h1 style="font-size: 14px; letter-spacing: 2px; display: flex; align-items: center; gap: 6px;">
        <span style="color: var(--text-dim); font-size: 16px;">[</span>
        <span style="color: var(--blue); font-size: 12px; text-shadow: 0 0 6px var(--blue-glow);">PX</span>
        <span style="color: var(--text-dim); font-size: 16px;">]</span>
        <span>PIX<span style="color: var(--green); text-shadow: 0 0 6px var(--green-glow);">DOCK</span></span>
      </h1>
      <div style="display: flex; gap: 18px; align-items: center; font-size: 8px; color: var(--text-dim);">
        <span style="display: flex; gap: 6px; align-items: center;">
          <Led tone={$connectionStatus === 'connected' ? 'green' : 'red'} blink={$connectionStatus === 'connecting'} /> 
          {$connectionStatus.toUpperCase()}
        </span>
        <span style="color: var(--yellow); border: 1px solid var(--yellow); padding: 3px 7px; font-size: 7px;">
          {$dockerMode.toUpperCase()}
        </span>
        {#if $dockerMode === 'swarm'}
          <span>NODES: <span style="color: var(--text);">{$stats.readyNodes}/{$stats.totalNodes}</span></span>
          <span>SVCS: <span style="color: var(--text);">{$stats.healthyServices}/{$stats.totalServices}</span></span>
        {/if}
        <span>CTR: <span style="color: var(--green);">{$stats.runningContainers}/{$stats.totalContainers}</span></span>
        <span style="color: var(--green); font-size: 7px; letter-spacing: 1px;">● LOGGED IN</span>
        <button onclick={handleLogout} style="font-size: 7px; color: var(--red); border: 1px solid var(--red); padding: 3px 8px;">LOGOUT</button>
      </div>
    </header>

    <!-- OVERVIEW RIBBON -->
    <section style="margin: 8px;">
      <h2 style="font-size: 9px; color: var(--blue); margin-bottom: 8px; letter-spacing: 2px;">▶ SYSTEM OVERVIEW</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        {#each [
          { label: 'HOSTS',      val: $stats.readyNodes, tot: $stats.totalNodes, color: 'var(--blue)' },
          { label: 'CONTAINERS', val: $stats.runningContainers, tot: $stats.totalContainers, color: 'var(--green)' },
          { label: 'SERVICES',   val: $stats.healthyServices, tot: $stats.totalServices, color: 'var(--green)' },
          { label: 'IMAGES',     val: '?', tot: null, color: 'var(--purple)' },
        ] as s}
          <div class="pd-pixel-border" style="padding: 10px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 7px; color: var(--text-dim);">
              <span>{s.label}</span>
              <Led tone={s.color === 'var(--red)' ? 'red' : 'green'} size="sm" />
            </div>
            <div style="font-size: 22px; color: {s.color}; letter-spacing: 1px; text-shadow: 0 0 8px {s.color};">
              {s.val}{#if s.tot !== null}<span style="font-size: 10px; color: var(--text-dim);">/{s.tot}</span>{/if}
            </div>
            <Sparkline data={spark(s.label.length * 7 + tick.value, 16, 0.55, 0.3)} width={140} height={16} color={s.color} fill />
          </div>
        {/each}
      </div>
    </section>

    <!-- NODE RACK -->
    {#if $dockerMode === 'swarm'}
    <section style="margin: 8px;">
      <h2 style="font-size: 9px; color: var(--blue); margin-bottom: 8px; letter-spacing: 2px;">▶ SERVER RACK</h2>
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
        {#each $nodes as n}
          <div class="pd-pixel-border" style="padding: 10px;">
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
              <Led tone={n.status === 'ready' ? 'green' : 'red'} />
              <Led tone={n.availability === 'active' ? 'green' : 'yellow'} />
              <span style="margin-left: auto; font-size: 10px; color: {n.role === 'manager' ? 'var(--yellow)' : 'var(--text-dim)'};">
                {n.role === 'manager' ? '★' : '●'}
              </span>
            </div>
            <div style="font-size: 9px; color: var(--text); margin-bottom: 2px;">{n.hostname}</div>
            <div style="font-size: 7px; color: var(--text-dim); margin-bottom: 8px;">{n.ip}</div>
            <div style="border-top: 2px solid var(--border); padding-top: 6px; font-size: 7px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-dim);">CPU</span>
                <Gauge value={Math.random()} width={50} segmented segs={10} />
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-dim);">MEM</span>
                <Gauge value={Math.random()} width={50} segmented segs={10} />
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-dim);">UP</span>
                <span style="color: var(--text);">UP</span>
              </div>
            </div>
            <div style="border-top: 2px solid var(--border); margin-top: 6px; padding-top: 4px; text-align: center; font-size: 7px; color: {n.status === 'ready' ? 'var(--green)' : 'var(--red)'};">
              {n.status.toUpperCase()}
            </div>
          </div>
        {/each}
      </div>
    </section>
    
    <!-- SERVICES -->
    <section style="margin: 8px;">
      <h2 style="font-size: 9px; color: var(--blue); margin-bottom: 8px; letter-spacing: 2px;">▶ SERVICES</h2>
      {#each Array.from($stacks.entries()) as [stack, svcs]}
        <div class="pd-pixel-border" style="padding: 10px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 6px;">
            <span style="font-size: 9px; color: var(--purple); letter-spacing: 1px;">{stack.toUpperCase()}</span>
            <span style="font-size: 7px; color: var(--text-dim);">{svcs.length} svc</span>
          </div>
          {#each svcs as svc}
            <div style="display: grid; grid-template-columns: 14px 1fr 110px 1.4fr auto; gap: 10px; align-items: center; padding: 4px 8px; background: var(--bg-dark); margin-bottom: 3px; font-size: 8px;">
              <Led tone={svc.replicas_running >= svc.replicas_desired ? 'green' : 'yellow'} />
              <span>{svc.name}</span>
              <div style="display: flex; gap: 6px; align-items: center;">
                <Gauge value={svc.replicas_running} max={svc.replicas_desired} width={48} tone="ok" />
                <span style="font-size: 7px; color: var(--text-dim);">{svc.replicas_running}/{svc.replicas_desired}</span>
              </div>
              <span style="font-size: 7px; color: var(--text-dim);">{svc.image}</span>
              <div style="display: flex; gap: 4px;">
                {#each (svc.ports || []) as p}
                  <span style="font-size: 7px; color: var(--blue); background: rgba(96,165,250,0.1); padding: 1px 4px; border: 1px solid var(--blue);">:{p.published}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </section>
    {/if}

    <!-- CONTAINERS -->
    <section style="margin: 8px;">
      <h2 style="font-size: 9px; color: var(--blue); margin-bottom: 8px; letter-spacing: 2px;">▶ CONTAINERS</h2>
      <div class="pd-pixel-border" style="padding: 8px; margin-bottom: 6px; display: flex; gap: 8px;">
        <input
          placeholder="search by name/image..."
          bind:value={search}
          style="flex: 1; background: var(--bg-dark); border: 2px solid var(--border); color: var(--text); padding: 6px 8px; font-size: 8px; font-family: inherit;"
        />
        <div style="display: flex; gap: 4px;">
          {#each ['ALL', 'RUNNING', 'STOPPED'] as f}
            <button onclick={() => filter = f} style="background: {filter === f ? 'var(--blue)' : 'var(--bg-panel)'}; color: {filter === f ? 'var(--bg-dark)' : 'var(--text-dim)'}; border: 2px solid var(--border); border-color: {filter === f ? 'var(--blue)' : 'var(--border)'}; font-size: 8px; padding: 6px 8px;">
              {f}
            </button>
          {/each}
        </div>
      </div>
      {#each groupedContainers() as [stack, ctrs]}
        <div class="pd-pixel-border" style="padding: 10px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid var(--border); padding-bottom: 5px; margin-bottom: 6px;">
            <span style="font-size: 9px; color: var(--purple); letter-spacing: 1px;">{stack.toUpperCase()}</span>
            <span style="font-size: 7px; color: var(--text-dim);">{ctrs.length} running</span>
          </div>
          {#each ctrs as c}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              onclick={() => sel = c.id}
              style="display: grid; grid-template-columns: 14px 1.4fr 70px 1.4fr auto auto; align-items: center; gap: 12px; padding: 5px 8px; font-size: 8px; background: {sel === c.id ? 'var(--bg-panel-light)' : 'var(--bg-dark)'}; border: {sel === c.id ? '1px solid var(--blue)' : '1px solid transparent'}; margin-bottom: 3px; cursor: pointer;"
            >
              <Led tone={stateLed(c.state)} />
              <span>{c.name}</span>
              <span style="color: var(--green); font-size: 7px;">{c.state.toUpperCase()}</span>
              <span style="font-size: 7px; color: var(--text-dim);">{c.image}</span>
              <span style="font-size: 7px; color: var(--text-dim);">{c.node || 'local'}</span>
              <div style="display: flex; gap: 4px;" onclick={e => e.stopPropagation()}>
                <ActionBtn icon="≡" tone="blue" title="logs" />
                <ActionBtn icon="■" tone="red" title="stop" />
                <ActionBtn icon="↻" tone="yellow" title="restart" />
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </section>

    <!-- STATUS BAR -->
    <footer style="display: flex; justify-content: space-between; padding: 6px 12px; background: var(--bg-panel); border-top: 4px solid var(--border); font-size: 7px; color: var(--text-dim);">
      <span>PIXDOCK v0.2.0</span>
      <span>MODE: {$dockerMode.toUpperCase()}</span>
      <span>LAST UPDATE: {fmtClock(clock.value)}</span>
      <span style="color: var(--green);">WS: {$connectionStatus.toUpperCase()}</span>
    </footer>
  </div>
</div>
