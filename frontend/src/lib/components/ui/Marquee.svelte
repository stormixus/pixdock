<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    speed?: number;
    style?: string;
    children: Snippet;
  }

  let { speed = 22, style = '', children }: Props = $props();
</script>

<div style="overflow: hidden; white-space: nowrap; {style}">
  <div style="display: inline-block; animation: pd-marq {speed}s linear infinite; padding-left: 100%;">
    {@render children()}
  </div>
</div>
