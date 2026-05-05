<script lang="ts">
  interface Props {
    tone?: 'green' | 'red' | 'yellow' | 'blue';
    size?: 'sm' | 'md' | 'lg';
    blink?: boolean;
    class?: string;
    style?: string;
  }

  let { tone = 'green', size = 'md', blink = false, class: className = '', style = '' }: Props = $props();

  let classes = $derived([
    'pd-led',
    size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '',
    `pd-led-${tone}`,
    blink ? 'pd-blink' : '',
    className
  ].filter(Boolean).join(' '));
</script>

<span class={classes} {style}></span>
