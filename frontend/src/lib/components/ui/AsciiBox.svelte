<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    color?: string;
    style?: string;
    class?: string;
    children: Snippet;
  }

  let { color = 'var(--text-dim)', style = '', class: className = '', children }: Props = $props();
</script>

<div
  class={className}
  style="border: 1px solid {color}; padding: 6px 8px; position: relative; {style}"
>
  {@render children()}
</div>
