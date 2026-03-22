<script lang="ts">
	import { setContext } from "svelte";
	import RecipeCard from "../components/RecipeCard.svelte";
	import type { App } from "obsidian";
	import type { Recipe } from "../../utils/recipeUtils";
	import { flushCookSoon } from "../../utils/recipeUtils";
	import type { Readable } from "svelte/store";

	const { stores, propsToShow, app } = $props<{
		stores: import("../../utils/recipeStores").RecipeStores;
		propsToShow?: string[];
		app: App;
	}>();

	// svelte-ignore state_referenced_locally
	let recipes: Readable<Recipe[]> = stores.recipes;

	// svelte-ignore state_referenced_locally — app is a stable reference, never changes
	setContext("app", app);

	// ─── Filter system ────────────────────────────────────────────────────────
	const EXCLUDED_KEYS = new Set([
		"path",
		"__tags",
		"position",
		"cook_soon",
		"cook-soon",
		"tags",
		"title",
		"cover",
	]);

	interface FilterMeta {
		values: string[];
		isNumeric: boolean;
	}

	type StringFilter = { type: "string"; value: string };
	type NumericFilter = { type: "numeric"; op: "<" | "=" | ">"; value: string };
	type FilterValue = StringFilter | NumericFilter;

	function isAllNumeric(values: string[]): boolean {
		return (
			values.length > 0 &&
			values.every((v) => v !== "" && isFinite(Number(v)))
		);
	}

	function buildFilterOptions(recipeList: Recipe[]): Map<string, FilterMeta> {
		const raw = new Map<string, string[]>();
		for (const r of recipeList) {
			for (const [k, v] of Object.entries(r)) {
				if (EXCLUDED_KEYS.has(k) || k.startsWith("__")) continue;
				if (v === null || v === undefined) continue;
				const strVal = String(v);
				const existing = raw.get(k) ?? [];
				if (!existing.includes(strVal)) existing.push(strVal);
				raw.set(k, existing);
			}
		}
		const result = new Map<string, FilterMeta>();
		for (const [k, values] of raw) {
			result.set(k, { values, isNumeric: isAllNumeric(values) });
		}
		return result;
	}

	let filterOptions = $derived(buildFilterOptions($recipes));

	let activeFilters: Map<string, FilterValue> = $state(new Map());

	function addFilter(key: string) {
		if (!key || activeFilters.has(key)) return;
		const meta = filterOptions.get(key);
		const initial: FilterValue = meta?.isNumeric
			? { type: "numeric", op: "=", value: "" }
			: { type: "string", value: "" };
		activeFilters = new Map([...activeFilters, [key, initial]]);
	}

	function setStringValue(key: string, value: string) {
		activeFilters = new Map([
			...activeFilters,
			[key, { type: "string", value }],
		]);
	}

	function setNumericOp(key: string, op: "<" | "=" | ">") {
		const existing = activeFilters.get(key) as NumericFilter;
		activeFilters = new Map([
			...activeFilters,
			[key, { ...existing, op }],
		]);
	}

	function setNumericValue(key: string, value: string) {
		const existing = activeFilters.get(key) as NumericFilter;
		activeFilters = new Map([
			...activeFilters,
			[key, { ...existing, value }],
		]);
	}

	function removeFilter(key: string) {
		const next = new Map(activeFilters);
		next.delete(key);
		activeFilters = next;
	}

	function clearFilters() {
		activeFilters = new Map();
	}

	function recipeMatchesFilters(r: Recipe): boolean {
		for (const [key, filter] of activeFilters) {
			const raw = r[key];
			if (filter.type === "string") {
				if (!filter.value) continue;
				if (String(raw ?? "") !== filter.value) return false;
			} else {
				if (!filter.value) continue;
				const rNum = parseFloat(String(raw ?? ""));
				const fNum = parseFloat(filter.value);
				if (isNaN(rNum) || isNaN(fNum)) continue;
				if (filter.op === "<" && !(rNum < fNum)) return false;
				if (filter.op === "=" && rNum !== fNum) return false;
				if (filter.op === ">" && !(rNum > fNum)) return false;
			}
		}
		return true;
	}

	let filteredRecipes = $derived($recipes.filter(recipeMatchesFilters));

	let availableKeysToAdd = $derived(
		[...filterOptions.keys()].filter((k) => !activeFilters.has(k)),
	);

	// ─── Cook-soon toggle ─────────────────────────────────────────────────────
	function toggleCookSoon(path: string) {
		let toggled: Recipe | undefined;
		stores.recipes.update((list: Recipe[]) =>
			list.map((r: Recipe) => {
				if (r.path !== path) return r;
				toggled = { ...r, cook_soon: !r.cook_soon, "cook-soon": !r["cook-soon"] };
				return toggled;
			}),
		);
		if (toggled) void flushCookSoon(toggled, app);
	}

	function setMultiplier(path: string, multiplier: number) {
		stores.recipes.update((list: Recipe[]) =>
			list.map((r: Recipe) =>
				r.path === path ? { ...r, cook_multiplier: multiplier } : r,
			),
		);
	}
</script>

<div class="recipes-modal">
	<!-- Filter bar — always visible -->
	<div class="filter-bar">
		{#each [...activeFilters] as [key, filter]}
			<div class="filter-chip">
				<span class="filter-key">{key}</span>

				{#if filter.type === "numeric"}
					<select
						value={filter.op}
						onchange={(e) =>
							setNumericOp(
								key,
								(e.currentTarget as HTMLSelectElement)
									.value as "<" | "=" | ">",
							)}
						class="op-select"
					>
						<option value="<">&lt;</option>
						<option value="=">=</option>
						<option value=">">&gt;</option>
					</select>
					<input
						class="num-input"
						type="number"
						value={filter.value}
						placeholder="value"
						oninput={(e) =>
							setNumericValue(
								key,
								(e.currentTarget as HTMLInputElement).value,
							)}
					/>
				{:else}
					<select
						value={filter.value}
						onchange={(e) =>
							setStringValue(
								key,
								(e.currentTarget as HTMLSelectElement).value,
							)}
					>
						<option value="">Any</option>
						{#each filterOptions.get(key)?.values ?? [] as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				{/if}

				<button
					class="filter-remove"
					onclick={() => removeFilter(key)}>✕</button
				>
			</div>
		{/each}

		{#if availableKeysToAdd.length > 0}
			<select
				class="add-filter-select"
				onchange={(e) => {
					addFilter((e.currentTarget as HTMLSelectElement).value);
					(e.currentTarget as HTMLSelectElement).value = "";
				}}
			>
				<option value="">+ Add filter…</option>
				{#each availableKeysToAdd as key}
					<option value={key}
						>{key}{filterOptions.get(key)?.isNumeric
							? " (numeric)"
							: ""}</option
					>
				{/each}
			</select>
		{:else if filterOptions.size === 0}
			<span class="filter-empty">No filterable properties found</span>
		{/if}

		{#if activeFilters.size > 0}
			<button class="clear-filters" onclick={clearFilters}
				>Clear all</button
			>
		{/if}
	</div>

	<div class="recipe-count">
		{filteredRecipes.length} recipe{filteredRecipes.length !== 1
			? "s"
			: ""}
		{#if activeFilters.size > 0}(filtered from {$recipes.length}){/if}
	</div>

	<div class="recipe-grid">
		{#if $recipes === undefined}
			<p>Loading recipes…</p>
		{:else if filteredRecipes.length === 0 && activeFilters.size > 0}
			<p>No recipes match the current filters.</p>
		{:else if $recipes.length === 0}
			<p>
				No recipes found. Add the <code>#recipe</code> tag to your
				recipe notes.
			</p>
		{:else}
			{#each filteredRecipes as recipe (recipe.path)}
				<RecipeCard
					{recipe}
					{propsToShow}
					{app}
					onToggleCookSoon={() => toggleCookSoon((recipe as Recipe).path)}
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

	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem;
		background: var(--background-secondary);
		border-radius: 6px;
		min-height: 2.4rem;
	}

	.filter-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--background-modifier-border);
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.85em;
	}

	.filter-key {
		font-weight: 600;
		color: var(--text-accent);
	}

	.op-select {
		width: 42px;
		font-size: 0.9em;
		padding: 1px 2px;
		border-radius: 3px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		text-align: center;
	}

	.num-input {
		width: 58px;
		font-size: 0.9em;
		padding: 1px 4px;
		border-radius: 3px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}

	/* hide browser spinner on number input */
	.num-input::-webkit-inner-spin-button,
	.num-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
	}

	.filter-remove {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		padding: 0 2px;
		font-size: 0.8em;
	}

	.filter-remove:hover {
		color: var(--text-normal);
	}

	.add-filter-select {
		font-size: 0.85em;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		padding: 2px 4px;
		cursor: pointer;
	}

	.filter-empty {
		font-size: 0.82em;
		color: var(--text-faint);
		font-style: italic;
	}

	.clear-filters {
		font-size: 0.8em;
		color: var(--text-muted);
		cursor: pointer;
		background: none;
		border: none;
		text-decoration: underline;
		margin-left: auto;
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
