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
	import { matchesQuickFilter, mealTypes } from "../../recipes/browse";
	import type { QuickFilter } from "../../recipes/browse";
	import { obsidianIcon } from "../../utils/obsidianIcon";

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

	// ─── Search and quick filters ───────────────────────────────────────────────
	let query = $state("");
	let onlyCookSoon = $state(false);
	let onlyUntried = $state(false);
	let pickedMealTypes: string[] = $state([]);
	/** The full filter builder; opens by itself while any of its filters are set. */
	let showFilters = $state(false);

	let quick: QuickFilter = $derived({
		query,
		cookSoon: onlyCookSoon,
		untried: onlyUntried,
		mealTypes: pickedMealTypes,
	});
	let quickActive = $derived(!!query.trim() || onlyCookSoon || onlyUntried || pickedMealTypes.length > 0);
	let anyFilter = $derived(quickActive || activeFilters.size > 0);

	let cookSoonCount = $derived($recipes.filter((r) => r.cook_soon).length);
	let tracksTried = $derived($recipes.some((r) => "tried" in r));
	let mealTypeOptions = $derived(mealTypes($recipes).slice(0, 6));

	function toggleMealType(type: string) {
		pickedMealTypes = pickedMealTypes.includes(type)
			? pickedMealTypes.filter((t) => t !== type)
			: [...pickedMealTypes, type];
	}

	function clearFilters() {
		query = "";
		onlyCookSoon = false;
		onlyUntried = false;
		pickedMealTypes = [];
		activeFilters = new Map();
	}

	let matchingRecipes = $derived(
		$recipes.filter((r) =>
			matchesQuickFilter(r, quick) &&
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
	<div class="browse-bar">
		<div class="search-row">
			<div class="search-box">
				<span class="search-icon" use:obsidianIcon={"search"} aria-hidden="true"></span>
				<input
					type="search"
					placeholder="Search recipes or cuisines"
					aria-label="Search recipes"
					bind:value={query}
				/>
			</div>
			<button
				class="filters-btn"
				class:is-on={activeFilters.size > 0}
				aria-expanded={showFilters || activeFilters.size > 0}
				onclick={() => (showFilters = !showFilters)}
			>
				<span use:obsidianIcon={"sliders-horizontal"} aria-hidden="true"></span>
				Filters{#if activeFilters.size > 0}&nbsp;· {activeFilters.size}{/if}
			</button>
		</div>
		<div class="quick-chips" role="group" aria-label="Quick filters">
			<button class="quick-chip" aria-pressed={onlyCookSoon} onclick={() => (onlyCookSoon = !onlyCookSoon)}>
				Cook soon{#if cookSoonCount > 0}&nbsp;<span class="chip-count">{cookSoonCount}</span>{/if}
			</button>
			{#if tracksTried}
				<button class="quick-chip" aria-pressed={onlyUntried} onclick={() => (onlyUntried = !onlyUntried)}>
					Not tried yet
				</button>
			{/if}
			{#each mealTypeOptions as type (type)}
				<button
					class="quick-chip"
					aria-pressed={pickedMealTypes.includes(type)}
					onclick={() => toggleMealType(type)}
				>{type}</button>
			{/each}
		</div>
	</div>

	{#if showFilters || activeFilters.size > 0}
		<FilterBar
			filters={activeFilters}
			{filterOptions}
			{ingredientGroups}
			{allIngredientNames}
			{ingredientsReady}
			onChange={(next) => (activeFilters = next)}
		/>
	{/if}

	<div class="cookbook-toolbar">
		<div class="cookbook-count">
			{filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? "s" : ""}
			{#if anyFilter}
				of {$recipes.length}
				<button class="clear-btn" onclick={clearFilters}>Clear</button>
			{/if}
		</div>
		<label class="sort-control">
			Sort
			<select class="dropdown" bind:value={sortMode} disabled={!ingredientsReady}>
				<option value="name">Default</option>
				<option value="overlap" disabled={cookTogetherPaths.length === 0}>
					Overlap with cook-together set
				</option>
			</select>
		</label>
	</div>

	<div class="cookbook-grid">
		{#if filteredRecipes.length === 0 && anyFilter}
			<p class="empty">No recipes match. <button class="clear-btn" onclick={clearFilters}>Clear filters</button></p>
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

	.browse-bar {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.search-row {
		display: flex;
		gap: var(--size-4-2);
	}

	.search-box {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: var(--size-4-2);
		display: inline-flex;
		color: var(--text-faint);
		--icon-size: 16px;
		pointer-events: none;
	}

	.search-box input {
		width: 100%;
		padding-left: calc(var(--size-4-2) * 2 + 16px);
	}

	.filters-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--size-2-3);
		white-space: nowrap;
	}

	.filters-btn.is-on {
		color: var(--text-accent);
	}

	.quick-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-1);
	}

	.quick-chip {
		height: auto;
		padding: var(--size-2-2) var(--size-4-3);
		border-radius: var(--radius-l);
		font-size: var(--font-ui-small);
		background: var(--background-secondary);
		box-shadow: none;
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
	}

	.quick-chip:hover {
		color: var(--text-normal);
	}

	.quick-chip[aria-pressed="true"] {
		background: color-mix(in srgb, var(--interactive-accent) 16%, var(--background-secondary));
		border-color: var(--interactive-accent);
		color: var(--text-normal);
	}

	.chip-count {
		color: var(--text-accent);
		font-weight: var(--font-semibold);
	}

	.clear-btn {
		all: unset;
		margin-left: var(--size-2-3);
		color: var(--text-accent);
		cursor: pointer;
	}

	.clear-btn:hover {
		text-decoration: underline;
	}

	.empty {
		grid-column: 1 / -1;
		color: var(--text-muted);
	}

	.cookbook-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.cookbook-count {
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

	.cookbook-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
		gap: 1rem;
	}
</style>
