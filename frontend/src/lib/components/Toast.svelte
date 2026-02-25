<script lang="ts">
  import { toasts } from '$lib/stores/swarm';
</script>

{#if $toasts.length > 0}
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}">
        <span class="toast-icon">
          {#if toast.type === 'success'}>{/if}
          {#if toast.type === 'error'}!{/if}
          {#if toast.type === 'warning'}?{/if}
          {#if toast.type === 'info'}i{/if}
        </span>
        <span class="toast-msg">{toast.message}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 60px;
    right: 12px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-size: 8px;
    border: var(--pixel-size) solid var(--border);
    background: var(--bg-panel);
    animation: toast-in 0.3s steps(5) forwards;
    pointer-events: auto;
  }

  .toast-icon {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: bold;
    border: 2px solid;
  }

  .toast-success { border-color: var(--green); }
  .toast-success .toast-icon { color: var(--green); border-color: var(--green); }

  .toast-error { border-color: var(--red); }
  .toast-error .toast-icon { color: var(--red); border-color: var(--red); }

  .toast-warning { border-color: var(--yellow); }
  .toast-warning .toast-icon { color: var(--yellow); border-color: var(--yellow); }

  .toast-info { border-color: var(--blue); }
  .toast-info .toast-icon { color: var(--blue); border-color: var(--blue); }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
