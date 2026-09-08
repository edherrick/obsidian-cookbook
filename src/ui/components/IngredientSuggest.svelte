<script lang="ts">
	const { names = [] as string[], onSelect, onClose } = $props<{
		names?: string[];
		onSelect: (name: string) => void;
		onClose: () => void;
	}>();

	let text = $state("");
	let highlighted = $state(0);

	let suggestions = $derived(
		names.filter((n: string) => n.includes(text.toLowerCase())).slice(0, 8),
	);

	function commit(name: string) {
		if (name) onSelect(name);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			highlighted = Math.min(highlighted + 1, suggestions.length - 1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (e.key === "Enter") {
			e.preventDefault();
			commit(suggestions[highlighted] ?? text.trim());
		} else if (e.key === "Escape") {
			onClose();
		}
	}

	function focusSelf(node: HTMLElement) {
		node.focus();
	}
</script>

<div class="suggest-wrapper">
	<input
		class="suggest-input"
		type="text"
		placeholder="Type ingredient…"
		bind:value={text}
		use:focusSelf
		oninput={() => (highlighted = 0)}
		onkeydown={handleKeydown}
		onblur={() => setTimeout(onClose, 150)}
	/>
	{#if suggestions.length > 0}
		<ul class="suggest-dropdown">
			{#each suggestions as s, i (s)}
				<li>
					<button
						class="suggest-item"
						class:highlighted={i === highlighted}
						onmousedown={() => commit(s)}
					>{s}</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.suggest-wrapper {
		position: relative;
		display: inline-flex;
		flex-direction: column;
	}

	.suggest-input {
		font-size: 0.85em;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid var(--text-accent);
		background: var(--background-primary);
		width: 140px;
	}

	.suggest-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 100;
		margin: 2px 0 0;
		padding: 2px 0;
		list-style: none;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 160px;
		max-height: 200px;
		overflow-y: auto;
	}

	.suggest-dropdown li {
		list-style: none;
	}

	.suggest-item {
		display: block;
		width: 100%;
		padding: 4px 10px;
		font-size: 0.85em;
		cursor: pointer;
		white-space: nowrap;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-normal);
	}

	.suggest-item:hover,
	.suggest-item.highlighted {
		background: var(--background-modifier-hover);
	}
</style>
