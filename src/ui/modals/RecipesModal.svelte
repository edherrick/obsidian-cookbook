<script lang="ts" runes>
	import { setContext } from "svelte";
	import RecipeCard from "../components/RecipeCard.svelte";
	import type { App } from "obsidian";

	const { recipes, propsToShow, app } = $props<{
		recipes?: Record<string, any>[];
		propsToShow?: string[];
		app: App;
	}>();

	// Svelte 5 runes context
	setContext("app", app);
</script>

<div class="recipe-grid">
	{#each recipes as recipe (recipe.path)}
		<RecipeCard {recipe} {propsToShow} />
	{/each}
</div>

<style>
	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 2fr));
		gap: 1rem;
		justify-items: center;
	}
</style>
