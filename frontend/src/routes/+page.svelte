<script lang="ts">
  import { onMount } from 'svelte';
  import { initSwarmConnection } from '$lib/stores/swarm';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import '../app.css';

  let cleanup: (() => void) | undefined;

  onMount(() => {
    const { disconnect } = initSwarmConnection();
    cleanup = disconnect;
    return () => cleanup?.();
  });
</script>

<svelte:head>
  <title>SwarmDash</title>
</svelte:head>

<Dashboard />
