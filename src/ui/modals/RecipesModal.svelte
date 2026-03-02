<script lang="ts">
	import { setContext } from "svelte";
	import RecipeCard from "../components/RecipeCard.svelte";
	import type { App } from "obsidian";
	import type { Recipe } from "../../utils/recipeUtils";
	import type { Readable } from "svelte/store";
	const { stores, propsToShow, app } = $props<{
		stores: import("../../utils/recipeStores").RecipeStores;
		propsToShow?: string[];
		app: App;
	}>();

	// recipes store reference; assign immediately so `$recipes` is
	// defined during the first render. `stores` is stable so it's safe
	// despite the state_referenced_locally warning.
	// svelte-ignore state_referenced_locally - `stores` never changes after mount
	let recipes: Readable<Recipe[]> = stores.recipes;

	// Provide app context for child RecipeCard IMMEDIATELY (before render)
	setContext("app", app);

	// debug: watch mutation of the recipes store
	$effect(() => {
		console.log(
			"RecipesModal $recipes changed",
			$recipes.map((r) => ({ path: r.path, cook_soon: r.cook_soon })),
		);
	});

	// helper to toggle cook-soon flag and update store
	function toggleCookSoon(path: string) {
		console.log("toggleCookSoon called", path);
		stores.recipes.update((list: Recipe[]) =>
			list.map((r: Recipe) =>
				r.path === path
					? {
							...r,
							cook_soon: !r.cook_soon,
							"cook-soon": !r["cook-soon"], // keep the hyphen property in sync if present
						}
					: r,
			),
		);
		// log after update (subscribe flush will also log)
		console.log(
			"store after toggle",
			$recipes.map((r) => ({ path: r.path, cook_soon: r.cook_soon })),
		);
	}

	// the store subscription in recipeStores.ts already flushes cook-soon
	// changes immediately, so no need for onDestroy handling here.
</script>

<div class="recipe-grid">
	{#if $recipes}
		{#if $recipes.length === 0}
			<p>No recipes in store (length 0)</p>
		{:else}
			{#each $recipes as recipe (recipe.path)}
				<RecipeCard
					{recipe}
					{propsToShow}
					{app}
					onToggleCookSoon={() =>
						toggleCookSoon((recipe as Recipe).path)}
				/>
			{/each}
		{/if}
	{:else}
		<p>Loading recipes…</p>
	{/if}
</div>

<style>
	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 2fr));
		gap: 1rem;
		justify-items: center;
	}
</style>
