<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchContainerInspect } from '$lib/utils/ws';
	import type { ContainerInspectInfo } from '$lib/utils/ws';

	interface Props {
		containerId: string;
		containerName: string;
		onClose: () => void;
	}

	let { containerId, containerName, onClose }: Props = $props();

	let inspectInfo: ContainerInspectInfo | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);
	let activeTab: 'env' | 'mounts' | 'network' | 'ports' = $state('env');

	onMount(async () => {
		loading = true;
		try {
			inspectInfo = await fetchContainerInspect(containerId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		}
		loading = false;
	});
</script>

<div class="modal-backdrop">
	<div class="modal-content pixel-panel">
		<div class="modal-header">
			<span class="title">INSPECT: {containerName}</span>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</div>

		{#if loading}
			<div class="loading-state">
				<span class="blink-text">LOADING...</span>
			</div>
		{:else if error}
			<div class="error-state">
				<span class="led led-red"></span>
				ERR: {error}
			</div>
		{:else if inspectInfo}
			<div class="tabs">
				<button class:active={activeTab === 'env'} onclick={() => activeTab = 'env'}>ENV</button>
				<button class:active={activeTab === 'mounts'} onclick={() => activeTab = 'mounts'}>MOUNTS</button>
				<button class:active={activeTab === 'network'} onclick={() => activeTab = 'network'}>NETWORK</button>
				<button class:active={activeTab === 'ports'} onclick={() => activeTab = 'ports'}>PORTS</button>
			</div>

			<div class="tab-content">
				{#if activeTab === 'env'}
					<div class="env-list">
						{#each inspectInfo.config.env as e}
							<div>{e}</div>
						{/each}
					</div>
				{:else if activeTab === 'mounts'}
					<div class="mount-list">
						{#each inspectInfo.mounts as m}
							<div class="mount-item">
								<span>{m.type.toUpperCase()}</span>
								<span>{m.source}</span>
								<span>&rarr;</span>
								<span>{m.destination}</span>
								<span>{m.mode}</span>
							</div>
						{/each}
					</div>
				{:else if activeTab === 'network'}
					<div class="network-list">
						{#each Object.entries(inspectInfo.network_settings.networks) as [name, net]}
							<div class="network-item">
								<span class="net-name">{name}</span>
								<span>IP: {net.ip_address || 'N/A'}</span>
								<span>Gateway: {net.gateway || 'N/A'}</span>
							</div>
						{/each}
					</div>
				{:else if activeTab === 'ports'}
					<div class="port-list">
						{#each Object.entries(inspectInfo.network_settings.ports) as [portKey, publicBindings]}
							<div class="port-item">
								<span>{portKey} &rarr;</span>
								{#if publicBindings}
									{#each publicBindings as binding}
										<span>{binding.host_ip}:{binding.host_port}</span>
									{/each}
								{:else}
									<span>Not Exposed</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.7);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-content {
		width: 80%;
		max-width: 900px;
		height: 70%;
		padding: 12px;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		padding-bottom: 8px;
		margin-bottom: 8px;
		border-bottom: 2px solid var(--border);
	}

	.title {
		font-size: 9px;
		color: var(--purple);
		letter-spacing: 1px;
	}

	.close-btn {
		margin-left: auto;
		width: 20px;
		height: 20px;
		background: var(--bg-panel);
		border: 2px solid var(--border);
		color: var(--text-dim);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-family: 'Press Start 2P', monospace;
		line-height: 1;
	}

	.close-btn:hover {
		border-color: var(--red);
		color: var(--red);
	}

	.loading-state, .error-state {
		padding: 16px 8px;
		font-size: 8px;
		color: var(--text-dim);
	}

	.error-state { color: var(--red); }
	.blink-text { animation: blink 1s step-end infinite; }
	@keyframes blink { 50% { opacity: 0; } }

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 8px;
	}

	.tabs button {
		background: var(--bg-panel);
		border: 2px solid var(--border);
		color: var(--text-dim);
		font-size: 8px;
		padding: 6px 8px;
		cursor: pointer;
		font-family: 'Press Start 2P', monospace;
	}
	
	.tabs button.active {
		background: var(--blue);
		color: var(--bg-dark);
		border-color: var(--blue);
	}

	.tab-content {
		flex-grow: 1;
		overflow-y: auto;
		font-size: 8px;
		background: var(--bg-dark);
		padding: 8px;
		border: 2px solid var(--border);
		font-family: monospace;
		line-height: 1.6;
	}

	.env-list div, .mount-item, .network-item, .port-item {
		padding: 2px 4px;
	}
	
	.mount-item, .network-item, .port-item {
		display: flex;
		gap: 12px;
		white-space: pre;
	}
</style>
