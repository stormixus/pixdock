<script lang="ts">
  import { login, skipAuth } from '$lib/stores/auth';

  let token = $state('');
  let submitting = $state(false);
  let localError = $state<string | null>(null);

  interface Props {
    onconnect?: () => void;
  }

  let { onconnect }: Props = $props();

  function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      localError = 'TOKEN REQUIRED';
      return;
    }
    submitting = true;
    localError = null;
    login(trimmed);
    onconnect?.();
  }

  function handleOpenAccess() {
    submitting = true;
    localError = null;
    skipAuth();
    onconnect?.();
  }
</script>

<div class="crt">
  <div class="login-screen">
    <div class="scanlines"></div>

    <div class="terminal pixel-panel">
      <div class="terminal-header">
        <span class="led led-green blink"></span>
        <span class="led led-green blink" style="animation-delay: 0.3s"></span>
        <span class="led led-red"></span>
        <span class="header-label">PIXDOCK v1.0 :: AUTH TERMINAL</span>
      </div>

      <div class="boot-log">
        <p class="log-line"><span class="prompt">$</span> INITIALIZING PIXDOCK...</p>
        <p class="log-line"><span class="prompt">$</span> CHECKING CREDENTIALS...</p>
        <p class="log-line warn"><span class="prompt">!</span> ACCESS TOKEN REQUIRED</p>
      </div>

      <div class="logo-block">
        <pre class="pixel-logo">
 _____ _______   ______  ___  ______ _   __
|  __ \_   _\ \ / /  _ \/ _ \/ ____| | / /
| |__) || |  \ V /| | | | | | |     | |/ /
|  ___/ | |   | | | | | | | | |     |    \
| |    _| |_  | | | |/ /| |_| | |___| |\  \
|_|   |_____| |_| |___/  \___/ \_____|_| \_|</pre>
      </div>

      <form class="auth-form" onsubmit={handleSubmit}>
        <label class="field-label" for="token-input">
          <span class="prompt">&gt;</span> ENTER ACCESS TOKEN
        </label>

        <div class="input-row">
          <span class="input-prompt">&gt;&gt;</span>
          <input
            id="token-input"
            type="password"
            class="token-input"
            bind:value={token}
            placeholder="••••••••••••••••"
            autocomplete="current-password"
            spellcheck="false"
            disabled={submitting}
          />
          <span class="cursor blink">█</span>
        </div>

        {#if localError}
          <p class="error-line"><span class="prompt err">!</span> {localError}</p>
        {/if}

        <div class="button-row">
          <button type="submit" class="pixel-btn btn-connect" disabled={submitting}>
            {submitting ? 'CONNECTING...' : 'CONNECT'}
          </button>

          <button
            type="button"
            class="pixel-btn btn-open"
            disabled={submitting}
            onclick={handleOpenAccess}
          >
            OPEN ACCESS
          </button>
        </div>
      </form>

      <div class="footer-line">
        <span class="text-dim">SYSTEM: READY</span>
        <span class="text-dim">PROTOCOL: WS</span>
        <span class="text-dim blink">█</span>
      </div>
    </div>
  </div>
</div>

<style>
  .crt {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-dark);
  }

  .scanlines {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 50;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.08) 2px,
      rgba(0, 0, 0, 0.08) 4px
    );
  }

  .login-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 16px;
  }

  .terminal {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    z-index: 1;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 2px solid var(--border);
    padding-bottom: 12px;
  }

  .header-label {
    margin-left: 8px;
    font-size: 8px;
    color: var(--text-dim);
    letter-spacing: 1px;
  }

  .boot-log {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .log-line {
    font-size: 8px;
    color: var(--text-dim);
    display: flex;
    gap: 8px;
  }

  .log-line.warn {
    color: var(--yellow);
  }

  .prompt {
    color: var(--green);
    flex-shrink: 0;
  }

  .prompt.err {
    color: var(--red);
  }

  .logo-block {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
    text-align: center;
    overflow: hidden;
  }

  .pixel-logo {
    font-family: monospace;
    font-size: 5.5px;
    line-height: 1.4;
    color: var(--green);
    text-shadow: 0 0 8px var(--green);
    letter-spacing: 0;
    white-space: pre;
    display: inline-block;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field-label {
    font-size: 9px;
    color: var(--text);
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #050510;
    border: 2px solid var(--green);
    padding: 10px 12px;
    box-shadow: 0 0 6px rgba(74, 222, 128, 0.2);
  }

  .input-prompt {
    color: var(--green);
    font-size: 9px;
    flex-shrink: 0;
  }

  .token-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: var(--green);
    caret-color: transparent; /* we show our own cursor */
    letter-spacing: 2px;
  }

  .token-input::placeholder {
    color: var(--green-dark);
    opacity: 0.6;
  }

  .token-input:disabled {
    opacity: 0.5;
  }

  .cursor {
    color: var(--green);
    font-size: 10px;
    flex-shrink: 0;
  }

  .error-line {
    font-size: 8px;
    color: var(--red);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 1px;
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }

  .pixel-btn {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    border: 2px solid;
    padding: 10px 16px;
    cursor: pointer;
    letter-spacing: 1px;
    image-rendering: pixelated;
    transition: none;
  }

  .pixel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-connect {
    background: var(--green);
    color: var(--bg-dark);
    border-color: var(--green);
    flex: 1;
  }

  .btn-connect:not(:disabled):hover {
    background: var(--bg-dark);
    color: var(--green);
    box-shadow: 0 0 8px var(--green);
  }

  .btn-connect:not(:disabled):active {
    transform: translate(2px, 2px);
  }

  .btn-open {
    background: transparent;
    color: var(--text-dim);
    border-color: var(--border);
    font-size: 7px;
  }

  .btn-open:not(:disabled):hover {
    color: var(--yellow);
    border-color: var(--yellow);
    box-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
  }

  .footer-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border);
    padding-top: 12px;
    font-size: 7px;
  }

  .text-dim {
    color: var(--text-dim);
  }
</style>
