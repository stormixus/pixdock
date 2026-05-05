<script lang="ts">
  interface Props {
    size?: number;
    color?: string;
    class?: string;
  }

  let { size = 8, color = 'var(--yellow)', class: className = '' }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 5 5" class={className} style="shape-rendering: crispEdges;">
  <rect x="2" y="0" width="1" height="5" fill={color} />
  <rect x="0" y="2" width="5" height="1" fill={color} />
  <rect x="1" y="1" width="3" height="3" fill={color} />
</svg>
