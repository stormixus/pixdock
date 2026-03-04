<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchImages, deleteImage } from '$lib/utils/ws';
  import type { DockerImage } from '$lib/utils/ws';
  import { addToast } from '$lib/stores/swarm';

  let images: DockerImage[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let deletingId: string | null = $state(null);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatAge(epochSec: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - epochSec;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function primaryTag(tags: string[]): string {
    if (!tags || tags.length === 0) return '<none>';
    return tags[0];
  }

  function isUntagged(tags: string[]): boolean {
    return !tags || tags.length === 0 || tags[0] === '<none>:<none>';
  }

  async function load() {
    loading = true;
    error = null;
    try {
      images = await fetchImages();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }
    loading = false;
  }

  async function handleDelete(img: DockerImage) {
    const tag = primaryTag(img.repo_tags);
    const confirmed = window.confirm(`Delete image ${tag} (${img.id})?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    deletingId = img.id;
    try {
      await deleteImage(img.id);
      addToast(`DELETE OK: ${tag}`, 'success');
      await load();
    } catch (e) {
      addToast(`DELETE FAILED: ${e instanceof Error ? e.message : 'error'}`, 'error');
    }
    deletingId = null;
  }

  onMount(() => {
    load();
  });
</script>

<div class="image-panel pixel-panel">
  <div class="panel-header">
    <span class="panel-title">IMAGE REGISTRY</span>
    <span class="panel-count">{images.length} images</span>
    <button class="refresh-btn" onclick={load} disabled={loading} title="Refresh">
      &#8635;
    </button>
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="blink-text">SCANNING...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <span class="led led-red"></span>
      ERR: {error}
    </div>
  {:else if images.length === 0}
    <div class="empty-state">NO IMAGES FOUND</div>
  {:else}
    <div class="image-table">
      <div class="image-row image-header-row">
        <div class="img-id">ID</div>
        <div class="img-tag">TAG</div>
        <div class="img-size">SIZE</div>
        <div class="img-age">CREATED</div>
        <div class="img-ctrs">CTRS</div>
        <div class="img-actions"></div>
      </div>

      {#each images as img}
        <div class="image-row" class:image-untagged={isUntagged(img.repo_tags)}>
          <div class="img-id">{img.id}</div>

          <div class="img-tag">
            {#if isUntagged(img.repo_tags)}
              <span class="untagged-badge">UNTAGGED</span>
            {:else}
              <span class="tag-primary">{primaryTag(img.repo_tags)}</span>
              {#if img.repo_tags.length > 1}
                <span class="tag-extra">+{img.repo_tags.length - 1}</span>
              {/if}
            {/if}
          </div>

          <div class="img-size">{formatSize(img.size)}</div>

          <div class="img-age">{formatAge(img.created)}</div>

          <div class="img-ctrs">
            {#if img.containers === -1}
              <span class="ctrs-unknown">?</span>
            {:else}
              <span class:ctrs-active={img.containers > 0}>{img.containers}</span>
            {/if}
          </div>

          <div class="img-actions">
            <button
              class="action-btn action-delete"
              disabled={deletingId === img.id}
              onclick={() => handleDelete(img)}
              title="Delete image"
            >&#10005;</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .image-panel {
    padding: 12px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }

  .panel-title {
    font-size: 9px;
    color: var(--purple);
    letter-spacing: 1px;
  }

  .panel-count {
    margin-left: auto;
    font-size: 7px;
    color: var(--text-dim);
  }

  .refresh-btn {
    width: 18px;
    height: 18px;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: 'Press Start 2P', monospace;
    line-height: 1;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: var(--blue);
    color: var(--blue);
  }

  .refresh-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: 16px 8px;
    font-size: 8px;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .error-state {
    color: var(--red);
  }

  .blink-text {
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  .image-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .image-row {
    display: grid;
    grid-template-columns: 90px 1fr 70px 60px 40px 28px;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    font-size: 8px;
    background: var(--bg-dark);
    border: 1px solid transparent;
  }

  .image-header-row {
    background: transparent;
    border-color: transparent;
    color: var(--text-dim);
    font-size: 7px;
    letter-spacing: 1px;
    padding-bottom: 4px;
  }

  .image-row:not(.image-header-row):hover {
    border-color: var(--border);
  }

  .image-untagged {
    opacity: 0.6;
  }

  .img-id {
    color: var(--text-dim);
    font-size: 7px;
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .img-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
  }

  .tag-primary {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-extra {
    font-size: 7px;
    color: var(--blue);
    background: rgba(96, 165, 250, 0.1);
    padding: 1px 4px;
    border: 1px solid var(--blue);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .untagged-badge {
    font-size: 7px;
    color: var(--yellow);
    background: rgba(251, 191, 36, 0.1);
    padding: 1px 4px;
    border: 1px solid var(--yellow);
    letter-spacing: 1px;
  }

  .img-size {
    color: var(--green);
    font-size: 7px;
    white-space: nowrap;
  }

  .img-age {
    color: var(--text-dim);
    font-size: 7px;
    white-space: nowrap;
  }

  .img-ctrs {
    font-size: 7px;
    color: var(--text-dim);
    text-align: center;
  }

  .ctrs-active {
    color: var(--green);
  }

  .ctrs-unknown {
    color: var(--text-dim);
    opacity: 0.5;
  }

  .img-actions {
    display: flex;
    justify-content: flex-end;
  }

  .action-btn {
    width: 18px;
    height: 18px;
    background: var(--bg-panel);
    border: 2px solid var(--border);
    color: var(--text-dim);
    font-size: 9px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: 'Press Start 2P', monospace;
    line-height: 1;
  }

  .action-delete:hover:not(:disabled) {
    border-color: var(--red);
    color: var(--red);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
