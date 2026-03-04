<script lang="ts">
  import { onMount } from 'svelte';
  import { initSwarmConnection } from '$lib/stores/swarm';
  import { isAuthenticated, handleAuthError } from '$lib/stores/auth';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import Login from '$lib/components/Login.svelte';
  import '../app.css';

  let cleanup: (() => void) | undefined;

  function connect() {
    cleanup?.();
    const { disconnect } = initSwarmConnection(() => {
      handleAuthError();
    });
    cleanup = disconnect;
  }

  onMount(() => {
    if ($isAuthenticated) {
      connect();
    }
    return () => cleanup?.();
  });

  function handleLogin() {
    connect();
  }
</script>

<svelte:head>
  <title>PixDock</title>
</svelte:head>

{#if $isAuthenticated}
  <Dashboard onlogout={() => { cleanup?.(); cleanup = undefined; }} />
{:else}
  <Login onconnect={handleLogin} />
{/if}
