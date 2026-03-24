<script lang="ts">
	import { getContext } from "svelte";
	import type { App } from "obsidian";
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { SvelteModalWrapper } from "../../utils/SvelteModalWrapper";
	import RecipeDetailModal from "../modals/RecipeDetailModal.svelte";

	const app = getContext<App>("app");

	const {
		recipe = {},
		propsToShow = [] as string[],
		coverField = "cover",
		cookProp = "cook-soon",
		onToggleCookSoon,
		onSetMultiplier,
	} = $props<{
		app: App;
		recipe: Record<string, any>;
		propsToShow?: string[];
		coverField?: string;
		cookProp?: string;
		onToggleCookSoon?: (path: string) => void;
		onSetMultiplier?: (path: string, multiplier: number) => void;
	}>();

	function openDetail() {
		new SvelteModalWrapper(app, RecipeDetailModal, {
			recipe,
			app,
			onToggleCookSoon: () =>
				onToggleCookSoon && onToggleCookSoon(recipe.path),
			onSetMultiplier: (m: number) =>
				onSetMultiplier && onSetMultiplier(recipe.path, m),
		}).open();
	}
</script>

<div class="recipe-card">
	{#if recipe[coverField]}
		<div class="recipe-cover-wrap">
			<img
				class="recipe-cover"
				src={recipe[coverField]}
				alt={recipe.title || "No title"}
				loading="lazy"
			/>
		</div>
	{/if}

	{#if recipe.title}
		<h1 class="recipe-title">
			<button
				class="recipe-link"
				onclick={openDetail}
				title="View recipe"
			>
				<span class="title-text">{recipe.title}</span>
				<span
					use:obsidianIcon={"eye"}
					class="recipe-icon"
				></span>
			</button>
		</h1>
	{/if}

	<div class="recipe-body">
		{#each propsToShow.filter((key: string) => key in recipe && key !== "title" && key !== coverField) as key (key)}
			{#if key !== cookProp}
				<span class="field-key">{key}</span>
				<span class="field-colon">:</span>
				<span class="field-value">{recipe[key]}</span>
			{:else}
				<span class="field-key">{key}</span>
				<span class="field-colon">:</span>
				<span class="field-value cook-soon-row">
					<input
						type="checkbox"
						checked={recipe[cookProp]}
						onchange={() =>
							onToggleCookSoon && onToggleCookSoon(recipe.path)}
					/>
					{#if recipe[cookProp]}
						<span class="multiplier">
							<button class="mult-btn" onclick={() => onSetMultiplier && onSetMultiplier(recipe.path, Math.max(1, (recipe.cook_multiplier ?? 1) - 1))}>−</button>
							<span class="mult-label">×{recipe.cook_multiplier ?? 1}</span>
							<button class="mult-btn" onclick={() => onSetMultiplier && onSetMultiplier(recipe.path, (recipe.cook_multiplier ?? 1) + 1)}>+</button>
						</span>
					{/if}
				</span>
			{/if}
		{/each}
	</div>
</div>

<style>
	.recipe-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		overflow: hidden;
		width: 100%;
		font-family: sans-serif;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		box-sizing: border-box;
	}

	/* Wrapper reserves space before the image loads, preventing layout shift.
	   aspect-ratio scales proportionally on any card width (mobile or desktop).
	   max-height caps it on very wide cards. */
	.recipe-cover-wrap {
		width: 100%;
		aspect-ratio: 16 / 9;
		max-height: 220px;
		overflow: hidden;
		background: var(--background-secondary);
		flex-shrink: 0;
	}

	.recipe-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.recipe-title {
		font-size: 1.2rem;
		font-weight: bold;
		margin: 0;
		padding: 0.5rem;
		text-align: center;
	}

	.recipe-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		color: inherit;
		cursor: pointer;
		text-align: center;
		border-radius: var(--radius-s);
	}

	.recipe-link:hover,
	.recipe-link:focus {
		background: var(--background-modifier-hover);
	}

	.title-text {
		flex: 1 1 0;
		min-width: 0;
		overflow-wrap: break-word;
		white-space: normal;
		text-align: center;
	}

	.recipe-icon {
		margin-left: 0.25rem;
	}

	.recipe-body {
		padding: 0.5rem;
		display: grid;
		grid-template-columns: max-content 0.6rem 1fr;
		column-gap: 0.4rem;
		row-gap: 0.25rem;
		align-items: baseline;
	}

	.field-key {
		text-align: right;
		font-weight: bold;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.field-colon {
		text-align: center;
		opacity: 0.6;
	}

	.field-value {
		text-align: left;
		overflow-wrap: anywhere;
	}

	.cook-soon-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.multiplier {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.mult-btn {
		background: none;
		border: 1px solid var(--background-modifier-border);
		border-radius: 3px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.8em;
		padding: 4px 8px;
		min-height: 28px;
		line-height: 1.4;
	}

	.mult-btn:hover {
		color: var(--text-normal);
		border-color: var(--text-accent);
	}

	.mult-label {
		font-size: 0.82em;
		color: var(--text-accent);
		font-weight: 600;
		min-width: 1.8em;
		text-align: center;
	}
</style>
