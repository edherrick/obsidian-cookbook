<script lang="ts">
	const { value, onDecrement, onIncrement, compact = false } = $props<{
		value: number;
		onDecrement: () => void;
		onIncrement: () => void;
		/** Small enough to sit inside a recipe card's Cook soon chip. */
		compact?: boolean;
	}>();
</script>

<span class="multiplier" class:compact>
	<button
		class="mult-btn"
		aria-label="Decrease multiplier"
		disabled={value <= 1}
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
		padding: 0 8px;
		min-height: 44px;
		line-height: 1;
	}

	.mult-btn:hover:not(:disabled) {
		color: var(--text-normal);
		border-color: var(--text-accent);
	}

	.mult-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.mult-label {
		font-size: 0.88em;
		color: var(--text-accent);
		font-weight: 600;
		min-width: 2em;
		text-align: center;
	}

	.multiplier.compact {
		gap: 0;
		padding-right: 2px;
	}

	.compact .mult-btn {
		border: none;
		box-shadow: none;
		min-height: 28px;
		min-width: 24px;
		padding: 0 4px;
	}

	.compact .mult-label {
		min-width: 1.6em;
		font-size: var(--font-ui-smaller);
	}
</style>
