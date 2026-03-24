<script lang="ts">
	const { value, onDecrement, onIncrement } = $props<{
		value: number;
		onDecrement: () => void;
		onIncrement: () => void;
	}>();
</script>

<span class="multiplier">
	<button
		class="mult-btn"
		aria-label="Decrease multiplier"
		onclick={onDecrement}
	>−</button>
	<span class="mult-label" aria-live="polite">×{value}</span>
	<button
		class="mult-btn"
		aria-label="Increase multiplier"
		onclick={onIncrement}
	>+</button>
</span>

<style>
	.multiplier {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.mult-btn {
		background: none;
		border: 1px solid var(--background-modifier-border);
		border-radius: 3px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.85em;
		padding: 0 10px;
		min-height: 36px;
		min-width: 36px;
		line-height: 1;
	}

	.mult-btn:hover {
		color: var(--text-normal);
		border-color: var(--text-accent);
	}

	.mult-label {
		font-size: 0.88em;
		color: var(--text-accent);
		font-weight: 600;
		min-width: 2em;
		text-align: center;
	}
</style>
