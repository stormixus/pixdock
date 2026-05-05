<script lang="ts">
  import { nodes, services, containers, stats } from '$lib/stores/swarm';
  import { fmtClock, createTicker, createClock } from '$lib/utils/mock.svelte';

  const tick = createTicker(700);
  const clock = createClock();

  const C0 = '#0f380f';   // darkest
  const C1 = '#306230';   // dark
  const C2 = '#8bac0f';   // light
  const C3 = '#9bbc0f';   // lightest (bg)
</script>

{#snippet Hdr({ title }: { title: string })}
  <div style="border-bottom: 2px solid {C0}; padding-bottom: 4px; margin-bottom: 10px; font-size: 10px; color: {C0}; letter-spacing: 2px;">
    {title}
  </div>
{/snippet}

{#snippet Stat({ label, v, sub }: { label: string, v: string | number, sub: string })}
  <div style="border-right: 2px dashed {C1}; padding: 0 6px;">
    <div style="font-size: 7px; color: {C1}; letter-spacing: 1px;">{label}</div>
    <div style="font-size: 22px; color: {C0}; line-height: 1.1; margin: 4px 0;">{v}</div>
    <div style="font-size: 6px; color: {C1};">{sub}</div>
  </div>
{/snippet}

{#snippet Mug({ blink, role }: { blink: boolean, role: string })}
  <svg width="48" height="40" viewBox="0 0 12 10" style="shape-rendering: crispEdges;">
    {#if role === 'manager'}
      <rect x="5" y="0" width="2" height="1" fill={C0} />
    {/if}
    <rect x="3" y="1" width="6" height="6" fill={C1} />
    <rect x="2" y="2" width="1" height="4" fill={C0} />
    <rect x="9" y="2" width="1" height="4" fill={C0} />
    <rect x="3" y="1" width="6" height="1" fill={C0} />
    <rect x="3" y="6" width="6" height="1" fill={C0} />
    {#if !blink}
      <rect x="4" y="3" width="1" height="1" fill={C0} />
      <rect x="7" y="3" width="1" height="1" fill={C0} />
    {:else}
      <rect x="4" y="3" width="1" height="1" fill={C2} />
      <rect x="7" y="3" width="1" height="1" fill={C2} />
    {/if}
    <rect x="4" y="5" width="4" height="1" fill={C0} />
    <rect x="3" y="7" width="6" height="2" fill={C1} />
    <rect x="3" y="7" width="1" height="2" fill={C0} />
    <rect x="8" y="7" width="1" height="2" fill={C0} />
    <rect x="3" y="9" width="6" height="1" fill={C0} />
  </svg>
{/snippet}

{#snippet Bigsprite()}
  <svg width="44" height="44" viewBox="0 0 11 11" style="shape-rendering: crispEdges;">
    <rect x="0" y="0" width="11" height="11" fill={C2} />
    <rect x="2" y="1" width="7" height="9" fill={C0} />
    <rect x="1" y="2" width="1" height="7" fill={C0} />
    <rect x="9" y="2" width="1" height="7" fill={C0} />
    <rect x="3" y="3" width="2" height="2" fill={C2} />
    <rect x="6" y="3" width="2" height="2" fill={C2} />
    <rect x="4" y="7" width="3" height="1" fill={C2} />
    <rect x="0" y="5" width="1" height="2" fill={C0} />
    <rect x="10" y="5" width="1" height="2" fill={C0} />
  </svg>
{/snippet}

<div class="pd-frame pd-crt" style="background: {C3}; color: {C0}; --crt: 0.35;">
  <div class="pd-crt-screen" style="height: 100%; overflow: auto; font-family: var(--font-pixel); font-size: 9px; padding: 14px;">

    <!-- TITLE CARD -->
    <div style="border: 4px solid {C0}; padding: 12px 14px; background: {C2}; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 4px 4px 0 {C1};">
      <div style="display: flex; align-items: center; gap: 8px;">
        {@render Bigsprite()}
        <div>
          <div style="font-size: 14px; color: {C0}; letter-spacing: 2px;">PIXDOCK</div>
          <div style="font-size: 7px; color: {C1}; letter-spacing: 1px; margin-top: 3px;">FLEET ADVENTURE</div>
        </div>
      </div>
      <div style="font-size: 8px; color: {C0}; text-align: right;">
        <div>{fmtClock(clock.value)}</div>
        <div style="margin-top: 3px; font-size: 7px; color: {C1};">● ● ● ●</div>
      </div>
    </div>

    <!-- PARTY STATUS -->
    <div style="border: 4px solid {C0}; background: #c1d680; padding: 12px; margin-bottom: 14px; box-shadow: 4px 4px 0 {C1};">
      {@render Hdr({ title: "◆ STATUS" })}
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        {@render Stat({ label: "HOSTS", v: $stats.totalNodes, sub: "ALL READY" })}
        {@render Stat({ label: "SERVICES", v: $stats.totalServices, sub: "ALL HEALTHY" })}
        {@render Stat({ label: "CONTAINERS", v: $stats.runningContainers, sub: "RUNNING" })}
        {@render Stat({ label: "IMAGES", v: "?", sub: "LOADED" })}
      </div>
    </div>

    <!-- NODES — party members -->
    <div style="border: 4px solid {C0}; background: #c1d680; padding: 12px; margin-bottom: 14px; box-shadow: 4px 4px 0 {C1};">
      {@render Hdr({ title: "◆ PARTY" })}
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
        {#each $nodes as n, i}
          <div style="border: 3px solid {C0}; background: {C3}; padding: 8px; text-align: center;">
            <div style="display: flex; justify-content: center; margin-bottom: 6px;">
              {@render Mug({ blink: (tick.value + i) % 5 === 0, role: n.role })}
            </div>
            <div style="font-size: 8px; color: {C0};">{n.hostname.toUpperCase()}</div>
            <div style="font-size: 6px; color: {C1}; margin-top: 2px;">LV.???</div>
            
            <div style="margin-top: 6px; font-size: 6px; color: {C1}; text-align: left;">HP</div>
            <div style="height: 8px; border: 2px solid {C0}; background: {C3}; position: relative;">
              <div style="height: 100%; width: 100%; background: {C0};"></div>
            </div>
            
            <div style="margin-top: 4px; font-size: 6px; color: {C1}; text-align: left;">MP</div>
            <div style="height: 8px; border: 2px solid {C0}; background: {C3}; position: relative;">
              <div style="height: 100%; width: 50%; background: {C1};"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- SERVICES — quest log -->
    <div style="border: 4px solid {C0}; background: #c1d680; padding: 12px; margin-bottom: 14px; box-shadow: 4px 4px 0 {C1};">
      {@render Hdr({ title: "◆ QUESTS" })}
      <div style="display: flex; flex-direction: column; gap: 4px;">
        {#each $services as s}
          <div style="display: grid; grid-template-columns: 20px 1fr 1.6fr 70px; align-items: center; gap: 10px; padding: 5px 8px; background: {C3}; border: 2px solid {C0}; font-size: 8px;">
            <span style="color: {C0};">★</span>
            <span style="color: {C0};">{(s.stack || '-').toUpperCase()}/{s.name}</span>
            <span style="color: {C1}; font-size: 7px;">{s.image}</span>
            <span style="color: {C0}; text-align: right;">{s.replicas_running}/{s.replicas_desired} ✓</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- DIALOG BOX -->
    <div style="border: 4px solid {C0}; background: #c1d680; padding: 14px 16px; box-shadow: 4px 4px 0 {C1}; position: relative;">
      <div style="font-size: 10px; color: {C0}; line-height: 1.6;">
        <div style="margin-bottom: 6px;">* You found <b>{$stats.runningContainers} containers</b> running peacefully.</div>
        <div style="margin-bottom: 6px;">* All {$stats.totalServices} services report healthy.</div>
        <div>* The fleet rests at <b>{fmtClock(clock.value)}</b>.</div>
      </div>
      <div style="position: absolute; bottom: 8px; right: 12px; font-size: 12px; color: {C0};" class="pd-blink">▼</div>
    </div>

    <!-- D-PAD HINT -->
    <div style="margin-top: 14px; display: flex; justify-content: space-between; font-size: 7px; color: {C1}; letter-spacing: 1px;">
      <span>↑↓←→ NAVIGATE</span>
      <span>Ⓐ INSPECT</span>
      <span>Ⓑ BACK</span>
      <span>SELECT MENU</span>
      <span>START PAUSE</span>
    </div>
  </div>
</div>
