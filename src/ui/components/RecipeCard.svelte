<script lang="ts">
	import { getContext } from "svelte";
	import type { App } from "obsidian";

	const app = getContext<App>("app"); // get app from context

	const {
		recipe = {},
		propsToShow = [] as string[],
		coverField = "cover",
		cookToggle = "cook-soon",
	} = $props<{
		app: App;
		recipe: Record<string, any>;
		propsToShow?: string[];
		coverField?: string;
		cookToggle?: string;
	}>();

	// Only show keys that exist on recipe, ignoring title & cover
	const visibleProps = propsToShow.filter(
		(key) => key in recipe && key !== "title" && key !== coverField,
	);

	function openRecipe() {
		app.workspace.openLinkText(recipe.path, "", false);
	}
</script>

<div class="recipe-card">
	{#if recipe[coverField]}
		<img
			class="recipe-cover"
			src={recipe[coverField]}
			alt={recipe.title || "No title"}
		/>
	{/if}

	{#if recipe.title}
		<h1 class="recipe-title">
			<button
				class="open-recipe-btn"
				onclick={openRecipe}
				title="Open recipe"
			>
				{recipe.title}
			</button>
		</h1>
	{/if}

	<div class="recipe-body">
		{#each visibleProps as key (key)}
			{#if key !== cookToggle}
				<span class="field-key">{key}</span>
				<span class="field-colon">:</span>
				<span class="field-value">{recipe[key]}</span>
			{:else}
				<span class="field-key">{key}</span>
				<span class="field-colon">:</span>
				<span class="field-value">
					<input type="checkbox" bind:checked={recipe[cookToggle]} />
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

	.recipe-cover {
		width: 100%;
		height: 180px;
		object-fit: cover;
	}

	.recipe-title {
		font-size: 1.2rem;
		font-weight: bold;
		margin: 0.5rem;
		text-align: center;
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

	.open-recipe-btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--text-accent);
		cursor: pointer;
		text-align: left;
	}
</style>
