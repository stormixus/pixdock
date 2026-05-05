<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: string;
    tone?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
    disabled?: boolean;
    title?: string;
    size?: number;
    onclick?: () => void;
    children?: Snippet;
  }

  let { icon, tone = 'blue', disabled = false, title = '', size = 18, onclick, children }: Props = $props();

  let hover = $state(false);
  let toneColor = $derived(`var(--${tone})`);
  
  let styles = $derived([
    `width: ${size}px; height: ${size}px;`,
    `background: ${hover ? toneColor : 'var(--bg-panel)'};`,
    `border: 2px solid ${hover ? toneColor : 'var(--border)'};`,
    `color: ${hover ? 'var(--bg-dark)' : 'var(--text-dim)'};`,
    `font-size: ${size * 0.55}px;`,
    `display: inline-flex; align-items: center; justify-content: center;`,
    `box-shadow: ${hover ? `0 0 6px ${toneColor}` : 'none'};`,
    `opacity: ${disabled ? 0.3 : 1};`,
    `cursor: ${disabled ? 'not-allowed' : 'pointer'};`,
    `padding: 0; line-height: 1;`
  ].join(' '));
</script>

<button
  {title}
  {disabled}
  style={styles}
  onmouseenter={() => hover = true}
  onmouseleave={() => hover = false}
  {onclick}
>
  {#if icon}{icon}{:else if children}{@render children()}{/if}
</button>
