<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    tone?: 'ok' | 'warn' | 'crit' | '';
    width?: number | string;
    height?: number;
    segmented?: boolean;
    segs?: number;
    class?: string;
  }

  let { value, max = 1, tone = '', width = 60, height = 10, segmented = false, segs = 12, class: className = '' }: Props = $props();

  let pct = $derived(Math.max(0, Math.min(1, value / max)));
  let calculatedTone = $derived(tone || (pct < 0.6 ? 'ok' : pct < 0.85 ? 'warn' : 'crit'));
  let fillTone = $derived(calculatedTone === 'ok' ? '' : calculatedTone === 'warn' ? 'warn' : 'crit');
  
  let lit = $derived(Math.round(pct * segs));
  let widthStyle = $derived(typeof width === 'number' ? `${width}px` : width);
</script>

{#if segmented}
  <span class="pd-segs {className}" style="width: {widthStyle}; height: {height}px;">
    {#each Array(segs) as _, i}
      <span class={i < lit ? 'on' : ''}></span>
    {/each}
  </span>
{:else}
  <span class="pd-gauge {className}" style="width: {widthStyle}; height: {height}px;">
    <span class="pd-gauge-fill {fillTone}" style="width: {pct * 100}%"></span>
  </span>
{/if}
