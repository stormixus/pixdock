<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    maxHeight?: number | string;
    style?: string;
    class?: string;
    children: Snippet;
  }

  let { maxHeight = '100%', style = '', class: className = '', children }: Props = $props();
  
  let maxHeightStyle = $derived(typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight);
</script>

<div class={className} style="max-height: {maxHeightStyle}; overflow: auto; {style}">
  {@render children()}
</div>
