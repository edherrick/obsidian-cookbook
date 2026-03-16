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
	} = $props<{
		app: App;
		recipe: Record<string, any>;
		propsToShow?: string[];
		coverField?: string;
		cookProp?: string;
		onToggleCookSoon?: (path: string) => void;
	}>();

	function openDetail() {
		new SvelteModalWrapper(app, RecipeDetailModal, {
			recipe,
			app,
			onToggleCookSoon: () =>
				onToggleCookSoon && onToggleCookSoon(recipe.path),
		}).open();
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
				<span class="field-value">
					<input
						type="checkbox"
						checked={recipe[cookProp]}
						onchange={() =>
							onToggleCookSoon && onToggleCookSoon(recipe.path)}
					/>
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
</style>
