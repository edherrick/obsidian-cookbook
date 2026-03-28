<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { onMount } from "svelte";
	import MultiplierControl from "../components/MultiplierControl.svelte";
	import { getRecipes, applyToggleCookSoon, applySetMultiplier } from "../../utils/recipeUtils";
	import type { Recipe } from "../../utils/recipeUtils";

	const { openRecipeModal, generateShoppingList, stores, app, close, cookSoonProp = "cook-soon", ignorePaths = [], recipesFolder, recipesTag = "#recipe" } =
		$props<{
			openRecipeModal: () => void;
			generateShoppingList: () => Promise<void>;
			stores: import("../../utils/recipeStores").RecipeStores;
			app: import("obsidian").App;
			close: () => void;
			cookSoonProp?: string;
			ignorePaths?: string[];
			recipesFolder?: string;
			recipesTag?: string;
		}>();

	// svelte-ignore state_referenced_locally — stores is a stable reference
	const { selectedRecipes } = stores;

	let generating = $state(false);

	onMount(async () => {
		const fresh = await getRecipes(app, cookSoonProp, ignorePaths, recipesFolder, recipesTag);
		stores.recipes.update((current: Recipe[]) => {
			const multiplierMap = new Map(current.map((r) => [r.path, r.cook_multiplier]));
			return fresh.map((r) => ({ ...r, cook_multiplier: multiplierMap.get(r.path) ?? 1 }));
		});
	});

	function toggleCookSoon(path: string) {
		applyToggleCookSoon(stores.recipes, path, app, cookSoonProp);
	}

	function setMultiplier(path: string, multiplier: number) {
		applySetMultiplier(stores.recipes, path, multiplier);
	}

	async function handleGenerate() {
		generating = true;
		try {
			await generateShoppingList();
			close();
		} finally {
			generating = false;
		}
	}
</script>

<div class="ribbon-modal-content">
	{#if $selectedRecipes && $selectedRecipes.length > 0}
		<div class="selected-recipes">
			<h3>Selected Recipes</h3>
			<ul>
				{#each $selectedRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={recipe.cook_soon}
							aria-label="Cook {(recipe as Recipe).title ?? (recipe as Recipe).path} soon"
							onchange={() => toggleCookSoon(recipe.path)}
						/>
						<span class="recipe-title">{(recipe as Recipe).title ?? (recipe as Recipe).path}</span>
						<span class="mult-push">
							<MultiplierControl
								value={recipe.cook_multiplier ?? 1}
								onDecrement={() => setMultiplier(recipe.path, Math.max(1, (recipe.cook_multiplier ?? 1) - 1))}
								onIncrement={() => setMultiplier(recipe.path, (recipe.cook_multiplier ?? 1) + 1)}
							/>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="no-selection">
			No recipes selected. Open the Cookbook and mark recipes as
			"cook soon".
		</p>
	{/if}

	<div class="btn-row">
		<button class="btn" onclick={openRecipeModal}>
			<span use:obsidianIcon={"book-open"} class="btn-icon"></span>
			<span class="btn-label">Open Cookbook</span>
		</button>

		<button class="btn" onclick={handleGenerate} disabled={generating}>
			<span
				use:obsidianIcon={"shopping-cart"}
				class="btn-icon"
			></span>
			<span class="btn-label"
				>{generating
					? "Generating…"
					: "Generate Shopping List"}</span
			>
		</button>
	</div>
</div>

<style>
	.ribbon-modal-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: min(280px, 100%);
	}

	.selected-recipes h3 {
		margin: 0 0 0.5rem;
		font-weight: bold;
	}

	.selected-recipes ul {
		margin: 0;
		padding-left: 0;
		list-style: none;
		max-height: 200px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.selected-recipes li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9em;
	}

	.recipe-title {
		flex: 1;
	}

	.mult-push {
		margin-left: auto;
		display: flex;
	}

	.no-selection {
		color: var(--text-muted);
		font-size: 0.9em;
		margin: 0;
	}

	.btn-row {
		display: flex;
		gap: 0.75rem;
	}

	.btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		justify-content: center;
	}
</style>
