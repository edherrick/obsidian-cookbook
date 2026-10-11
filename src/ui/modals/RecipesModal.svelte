<script lang="ts">
	import { setContext } from "svelte";
	import { get } from "svelte/store";
	import type { App } from "obsidian";
	import type { Readable } from "svelte/store";
	import RecipeCard from "../components/RecipeCard.svelte";
	import FilterBar from "../components/FilterBar.svelte";
	import type { Recipe } from "../../recipes/repository";
	import {
		applyToggleCookSoon,
		applyToggleCookTogether,
		applySetMultiplier,
	} from "../../recipes/repository";
	import {
		distinctiveIngredients,
		rankOverlap,
		unionIngredients,
	} from "../../recipes/overlap";
	import type { OverlapMatch, OverlapOptions } from "../../recipes/overlap";
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
		cookTogetherProp = "cook-together",
		coverProp = "cover",
		ingredientGroups = [],
		overlap,
	} = $props<{
		stores: import("../../recipes/recipeStores").RecipeStores;
		app: App;
		ingredientCache: IngredientCache;
		propsToShow?: string[];
		cookSoonProp?: string;
		cookTogetherProp?: string;
		coverProp?: string;
		ingredientGroups?: IngredientGroup[];
		overlap: OverlapOptions;
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
		"cook_together",
		"cook_multiplier",
		cookSoonProp,
		cookTogetherProp,
		"tags",
		"title",
		coverProp,
	]);

	let activeFilters: Map<string, FilterValue> = $state(new Map());

	let filterOptions = $derived(buildFilterOptions($recipes, EXCLUDED_KEYS));

	let matchingRecipes = $derived(
		$recipes.filter((r) =>
			recipeMatchesFilters(r, activeFilters, {
				ingredientsByPath: recipeIngredientMap,
				ingredientGroups,
				vocab: overlap.vocab,
			}),
		),
	);

	// ─── Overlap ──────────────────────────────────────────────────────────────
	let distinctiveByPath = $derived(
		new Map(
			[...recipeIngredientMap].map(
				([path, ings]) => [path, distinctiveIngredients(ings, overlap)] as const,
			),
		),
	);

	function getOverlap(path: string): OverlapMatch[] {
		const target = distinctiveByPath.get(path);
		if (!target) return [];
		return rankOverlap(target, distinctiveByPath, new Set([path]));
	}

	type SortMode = "name" | "overlap";
	let sortMode: SortMode = $state("name");

	let cookTogetherPaths = $derived($recipes.filter((r) => r.cook_together).map((r) => r.path));

	/**
	 * In overlap mode the cook-together set leads, then every other recipe by
	 * how much it shares with that set — the natural next one to add.
	 */
	let filteredRecipes = $derived.by(() => {
		if (sortMode !== "overlap" || cookTogetherPaths.length === 0) return matchingRecipes;
		const inSet = new Set(cookTogetherPaths);
		const target = unionIngredients(cookTogetherPaths, distinctiveByPath);
		const rank = new Map(
			rankOverlap(target, distinctiveByPath, inSet).map((m, i) => [m.path, i] as const),
		);
		const position = (r: Recipe) =>
			inSet.has(r.path) ? -1 : (rank.get(r.path) ?? Number.MAX_SAFE_INTEGER);
		return [...matchingRecipes].sort((a, b) => position(a) - position(b));
	});

	// ─── Cook-soon ────────────────────────────────────────────────────────────
	function toggleCookSoon(path: string) {
		applyToggleCookSoon(stores.recipes, path, app, cookSoonProp);
	}

	function toggleCookTogether(path: string) {
		applyToggleCookTogether(stores.recipes, path, app, cookTogetherProp);
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

	<div class="recipe-toolbar">
		<div class="recipe-count">
			{filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""}
			{#if activeFilters.size > 0}(filtered from {$recipes.length}){/if}
		</div>
		<label class="sort-control">
			Sort
			<select bind:value={sortMode} disabled={!ingredientsReady}>
				<option value="name">Default</option>
				<option value="overlap" disabled={cookTogetherPaths.length === 0}>
					Overlap with cook-together set
				</option>
			</select>
		</label>
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
					{cookTogetherProp}
					{coverProp}
					{getOverlap}
					onToggleCookSoon={() => toggleCookSoon(recipe.path)}
					onToggleCookTogether={() => toggleCookTogether(recipe.path)}
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

	.recipe-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.recipe-count {
		font-size: 0.85em;
		color: var(--text-muted);
	}

	.sort-control {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85em;
		color: var(--text-muted);
	}

	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
		gap: 1rem;
	}
</style>
