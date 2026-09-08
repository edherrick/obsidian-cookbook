<script lang="ts">
	import { setContext } from "svelte";
	import { get } from "svelte/store";
	import type { App } from "obsidian";
	import type { Readable } from "svelte/store";
	import RecipeCard from "../components/RecipeCard.svelte";
	import FilterBar from "../components/FilterBar.svelte";
	import type { Recipe } from "../../recipes/repository";
	import { applyToggleCookSoon, applySetMultiplier } from "../../recipes/repository";
	import type { ParsedIngredient } from "../../ingredients/parse";
	import type { IngredientCache } from "../../ingredients/cache";
	import type { IngredientGroup } from "../../types";
	import type { FilterValue } from "../../filters/model";
	import { buildFilterOptions, recipeMatchesFilters } from "../../filters/model";

	const {
		stores,
		app,
		ingredientCache,
		propsToShow,
		cookSoonProp = "cook-soon",
		coverProp = "cover",
		ingredientGroups = [],
	} = $props<{
		stores: import("../../recipes/recipeStores").RecipeStores;
		app: App;
		ingredientCache: IngredientCache;
		propsToShow?: string[];
		cookSoonProp?: string;
		coverProp?: string;
		ingredientGroups?: IngredientGroup[];
	}>();

	// svelte-ignore state_referenced_locally
	const recipes: Readable<Recipe[]> = stores.recipes;

	// svelte-ignore state_referenced_locally — app is a stable reference, never changes
	setContext("app", app);

	// ─── Ingredient loading ───────────────────────────────────────────────────
	let ingredientsReady = $state(false);
	let allIngredientNames: string[] = $state([]);
	let recipeIngredientMap: Map<string, ParsedIngredient[]> = $state(new Map());

	// The scan depends on *which* recipes exist, not on their contents. Keying
	// on paths keeps a cook-soon toggle from re-reading every recipe file and
	// blanking the ingredient autocomplete mid-interaction.
	let recipePathKey = $derived($recipes.map((r) => r.path).join("\n"));

	let scanToken = 0;

	$effect(() => {
		// Referenced for reactivity; the recipe objects are read untracked below
		void recipePathKey;
		const token = ++scanToken;

		const current: Recipe[] = get(recipes);

		void Promise.all(
			current.map(async (r) => {
				const ings = await ingredientCache.get(app, r);
				return [r.path, ings] as [string, ParsedIngredient[]];
			}),
		).then((entries) => {
			if (token !== scanToken) return; // a newer scan superseded this one
			const map = new Map(entries);
			recipeIngredientMap = map;
			const names = new Set<string>();
			for (const ings of map.values()) {
				for (const ing of ings) if (ing.text) names.add(ing.text.toLowerCase());
			}
			allIngredientNames = [...names].sort();
			ingredientsReady = true;
		});
	});

	// ─── Filters ──────────────────────────────────────────────────────────────
	// svelte-ignore state_referenced_locally
	const EXCLUDED_KEYS = new Set([
		"path",
		"__tags",
		"position",
		"cook_soon",
		"cook_multiplier",
		cookSoonProp,
		"tags",
		"title",
		coverProp,
	]);

	let activeFilters: Map<string, FilterValue> = $state(new Map());

	let filterOptions = $derived(buildFilterOptions($recipes, EXCLUDED_KEYS));

	let filteredRecipes = $derived(
		$recipes.filter((r) =>
			recipeMatchesFilters(r, activeFilters, {
				ingredientsByPath: recipeIngredientMap,
				ingredientGroups,
			}),
		),
	);

	// ─── Cook-soon ────────────────────────────────────────────────────────────
	function toggleCookSoon(path: string) {
		applyToggleCookSoon(stores.recipes, path, app, cookSoonProp);
	}

	function setMultiplier(path: string, multiplier: number) {
		applySetMultiplier(stores.recipes, path, multiplier);
	}
</script>

<div class="recipes-modal">
	<FilterBar
		filters={activeFilters}
		{filterOptions}
		{ingredientGroups}
		{allIngredientNames}
		{ingredientsReady}
		onChange={(next) => (activeFilters = next)}
	/>

	<div class="recipe-count">
		{filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""}
		{#if activeFilters.size > 0}(filtered from {$recipes.length}){/if}
	</div>

	<div class="recipe-grid">
		{#if filteredRecipes.length === 0 && activeFilters.size > 0}
			<p>No recipes match the current filters.</p>
		{:else if $recipes.length === 0}
			<p>
				No recipes found. Add the <code>#recipe</code> tag to your recipe notes.
			</p>
		{:else}
			{#each filteredRecipes as recipe (recipe.path)}
				<RecipeCard
					{recipe}
					{propsToShow}
					{cookSoonProp}
					{coverProp}
					onToggleCookSoon={() => toggleCookSoon(recipe.path)}
					onSetMultiplier={(path, m) => setMultiplier(path, m)}
				/>
			{/each}
		{/if}
	</div>
</div>

<style>
	.recipes-modal {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.recipe-count {
		font-size: 0.85em;
		color: var(--text-muted);
	}

	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
		gap: 1rem;
	}
</style>
