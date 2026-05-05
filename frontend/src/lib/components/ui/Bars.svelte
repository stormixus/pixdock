<script lang="ts">
  interface Props {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    gap?: number;
    class?: string;
  }

  let { data, width = 80, height = 24, color = 'var(--green)', gap = 1, class: className = '' }: Props = $props();

  let max = $derived(Math.max(...data, 0.01));
  let w = $derived((width - gap * (data.length - 1)) / Math.max(1, data.length));
</script>

<svg {width} {height} class={className} style="display: block; shape-rendering: crispEdges;">
  {#each data as v, i}
    {@const h = Math.max(1, (v / max) * height)}
    <rect x={i * (w + gap)} y={height - h} width={w} height={h} fill={color} />
  {/each}
</svg>
