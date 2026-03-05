<script lang="ts">
  interface Props {
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { message, confirmLabel = 'CONFIRM', onConfirm, onCancel }: Props = $props();
</script>

<div class="confirm-overlay" role="dialog">
  <div class="confirm-box pixel-panel">
    <p class="confirm-msg">{message}</p>
    <div class="confirm-actions">
      <button class="btn btn-cancel" onclick={onCancel}>CANCEL</button>
      <button class="btn btn-confirm" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .confirm-box {
    min-width: 320px;
    max-width: 480px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .confirm-msg {
    font-size: 8px;
    color: var(--text);
    line-height: 1.6;
    letter-spacing: 0.5px;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    padding: 6px 12px;
    cursor: pointer;
    letter-spacing: 1px;
    border: 2px solid;
    background: transparent;
  }

  .btn-cancel {
    color: var(--text-dim);
    border-color: var(--border);
  }

  .btn-cancel:hover {
    border-color: var(--text);
    color: var(--text);
  }

  .btn-confirm {
    color: var(--red);
    border-color: var(--red);
  }

  .btn-confirm:hover {
    background: var(--red);
    color: var(--bg-dark);
  }
</style>
