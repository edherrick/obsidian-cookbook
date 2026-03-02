<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { onMount } from "svelte";
	import { getRecipes } from "../../utils/recipeUtils";
	import type { Recipe } from "../../utils/recipeUtils";
	import type { Readable } from "svelte/store";

	const { openRecipeModal, generateShoppingList, stores, app } = $props<{
		openRecipeModal: () => void;
		generateShoppingList: () => void;
		stores: import("../../utils/recipeStores").RecipeStores;
		app: import("obsidian").App;
	}>();

	// expose two individual Svelte stores for direct `$` syntax
	const { recipes, selectedRecipes } = stores;

	// debug: watch selectedRecipes contents directly from store
	$effect(() => {
		console.log(
			"CookbookRibbonModal selectedRecipes:",
			$selectedRecipes.map((r) => ({
				path: r.path,
				cook_soon: r.cook_soon,
			})),
		);
	});

	onMount(async () => {
		// refresh recipes in case frontmatter changed while modal was closed
		const fresh = await getRecipes(app);
		stores.recipes.set(fresh);
	});

	// helper to flip cook-soon flag (deselect recipe)
	function toggleCookSoon(path: string) {
		stores.recipes.update((list: Recipe[]) =>
			list.map((r: Recipe) =>
				r.path === path
					? {
							...r,
							cook_soon: !r.cook_soon,
							"cook-soon": !r["cook-soon"],
						}
					: r,
			),
		);
	}
</script>

<div class="ribbon-modal-content">
	<!-- Currently selected recipes -->
	{#if $selectedRecipes && $selectedRecipes.length > 0}
		<div class="selected-recipes">
			<h3>Selected Recipes</h3>
			<ul>
				{#each $selectedRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={recipe.cook_soon}
							onchange={() => toggleCookSoon(recipe.path)}
						/>
						{(recipe as Recipe).title ?? (recipe as Recipe).path}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Buttons -->
	<div class="btn-row">
		<button class="btn" onclick={openRecipeModal}>
			<span use:obsidianIcon={"book-open"} class="btn-icon"></span>
			<span class="btn-label">Open Cookbook</span>
		</button>

		<button class="btn" onclick={generateShoppingList}>
			<span use:obsidianIcon={"shopping-cart"} class="btn-icon"></span>
			<span class="btn-label">Generate Shopping List</span>
		</button>
	</div>
</div>

<style>
	.ribbon-modal-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.selected-recipes h3 {
		margin: 0;
		font-weight: bold;
	}

	.selected-recipes ul {
		margin: 0;
		padding-left: 1rem;
		list-style-type: disc;
		max-height: 150px;
		overflow-y: auto;
	}

	.btn-row {
		display: flex;
		gap: 1rem;
	}
</style>
