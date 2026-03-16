<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { onMount } from "svelte";
	import { getRecipes } from "../../utils/recipeUtils";
	import type { Recipe } from "../../utils/recipeUtils";

	const { openRecipeModal, generateShoppingList, stores, app, close } =
		$props<{
			openRecipeModal: () => void;
			generateShoppingList: () => Promise<void>;
			stores: import("../../utils/recipeStores").RecipeStores;
			app: import("obsidian").App;
			close: () => void;
		}>();

	// svelte-ignore state_referenced_locally — stores is a stable reference
	const { selectedRecipes } = stores;

	let generating = $state(false);

	onMount(async () => {
		const fresh = await getRecipes(app);
		stores.recipes.set(fresh);
	});

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
							onchange={() => toggleCookSoon(recipe.path)}
						/>
						{(recipe as Recipe).title ?? (recipe as Recipe).path}
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
		min-width: 280px;
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
