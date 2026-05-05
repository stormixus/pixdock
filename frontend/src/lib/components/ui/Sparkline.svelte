<script lang="ts">
  interface Props {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fill?: boolean;
    class?: string;
  }

  let { data, width = 80, height = 20, color = 'var(--green)', fill = false, class: className = '' }: Props = $props();

  let max = $derived(Math.max(...data, 0.01));
  let stepX = $derived(width / Math.max(1, data.length - 1));
  let pts = $derived(data.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`));
  let path = $derived('M ' + pts.join(' L '));
  let area = $derived(`${path} L ${width},${height} L 0,${height} Z`);
</script>

<svg {width} {height} class={className} style="display: block; shape-rendering: crispEdges;">
  {#if fill}
    <path d={area} fill={color} fill-opacity="0.18" />
  {/if}
  <path d={path} fill="none" stroke={color} stroke-width="1.5" />
</svg>
