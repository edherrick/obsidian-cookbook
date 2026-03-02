<script lang="ts">
	import { setContext, onDestroy } from "svelte";
	import RecipeCard from "../components/RecipeCard.svelte";
	import type { App } from "obsidian";
	import { flushCookSoon } from "../../utils/recipeUtils";

	// Props from parent
	const { recipes, propsToShow, app } = $props<{
		recipes?: Record<string, any>[];
		propsToShow?: string[];
		app: App;
	}>();

	// Local state: directly editable recipes
	let localRecipes = $state(recipes ?? []);

	// Derived: recipes marked cook-soon
	const selectedRecipes = $derived(
		localRecipes.filter((r) => r["cook-soon"]),
	);

	// Provide app context for child RecipeCard
	setContext("app", app);

	// Flush cook-soon changes for all recipes on destroy
	onDestroy(async () => {
		await Promise.all(localRecipes.map((r) => flushCookSoon(r, app)));
	});
</script>

<div class="recipe-grid">
	{#each localRecipes as recipe (recipe.path)}
		<RecipeCard {recipe} {propsToShow} />
	{/each}
</div>

<style>
	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 2fr));
		gap: 1rem;
		justify-items: center;
	}
</style>
