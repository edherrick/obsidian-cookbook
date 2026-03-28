<script lang="ts">
	import { setContext } from "svelte";
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import RecipeCard from "../components/RecipeCard.svelte";
	import type { App } from "obsidian";
	import type { Recipe, ParsedIngredient } from "../../utils/recipeUtils";
	import { flushCookSoon, getRecipeIngredients } from "../../utils/recipeUtils";
	import type { Readable } from "svelte/store";
	import type { IngredientGroup } from "../../types";

	const { stores, propsToShow, app, cookSoonProp = "cook-soon", ingredientGroups = [] } = $props<{
		stores: import("../../utils/recipeStores").RecipeStores;
		propsToShow?: string[];
		app: App;
		cookSoonProp?: string;
		ingredientGroups?: IngredientGroup[];
	}>();

	// svelte-ignore state_referenced_locally
	let recipes: Readable<Recipe[]> = stores.recipes;

	// svelte-ignore state_referenced_locally — app is a stable reference, never changes
	setContext("app", app);

	// ─── Ingredient loading ───────────────────────────────────────────────────
	let ingredientsReady = $state(false);
	let allIngredientNames: string[] = $state([]);
	let recipeIngredientMap: Map<string, ParsedIngredient[]> = $state(new Map());

	$effect(() => {
		const currentRecipes = $recipes;
		ingredientsReady = false;
		Promise.all(
			currentRecipes.map(async (r) => {
				const ings = await getRecipeIngredients(app, r);
				return [r.path, ings] as const;
			}),
		).then((entries) => {
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

	// ─── Filter system ────────────────────────────────────────────────────────
	// svelte-ignore state_referenced_locally
	const EXCLUDED_KEYS = new Set([
		"path",
		"__tags",
		"position",
		"cook_soon",
		cookSoonProp,
		"tags",
		"title",
		"cover",
	]);

	const HAS_INGREDIENT_KEY = "__has-ingredient";
	const EXCLUDES_INGREDIENT_KEY = "__excludes-ingredient";
	const HAS_GROUP_KEY = "__has-group";
	const EXCLUDES_GROUP_KEY = "__excludes-group";

	interface FilterMeta {
		values: string[];
		isNumeric: boolean;
	}

	type StringFilter = { type: "string"; value: string };
	type NumericFilter = { type: "numeric"; op: "<" | "=" | ">"; value: string };
	type HasIngredientFilter = { type: "has-ingredient"; ingredients: string[]; logic: "and" | "or" };
	type ExcludesIngredientFilter = { type: "excludes-ingredient"; ingredients: string[] };
	type HasGroupFilter = { type: "has-group"; groups: string[]; logic: "and" | "or" };
	type ExcludesGroupFilter = { type: "excludes-group"; groups: string[] };
	type FilterValue = StringFilter | NumericFilter | HasIngredientFilter | ExcludesIngredientFilter | HasGroupFilter | ExcludesGroupFilter;

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
		if (key === HAS_INGREDIENT_KEY) {
			activeFilters = new Map([...activeFilters, [key, { type: "has-ingredient", ingredients: [], logic: "and" }]]);
			return;
		}
		if (key === EXCLUDES_INGREDIENT_KEY) {
			activeFilters = new Map([...activeFilters, [key, { type: "excludes-ingredient", ingredients: [] }]]);
			return;
		}
		if (key === HAS_GROUP_KEY) {
			activeFilters = new Map([...activeFilters, [key, { type: "has-group", groups: [], logic: "and" }]]);
			return;
		}
		if (key === EXCLUDES_GROUP_KEY) {
			activeFilters = new Map([...activeFilters, [key, { type: "excludes-group", groups: [] }]]);
			return;
		}
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

	// ─── Ingredient filter helpers ────────────────────────────────────────────
	function addIngredientToFilter(filterKey: string, ingredient: string) {
		const f = activeFilters.get(filterKey);
		if (!f || (f.type !== "has-ingredient" && f.type !== "excludes-ingredient")) return;
		if (f.ingredients.includes(ingredient)) return;
		activeFilters = new Map([...activeFilters, [filterKey, { ...f, ingredients: [...f.ingredients, ingredient] }]]);
	}

	function removeIngredientFromFilter(filterKey: string, ingredient: string) {
		const f = activeFilters.get(filterKey);
		if (!f || (f.type !== "has-ingredient" && f.type !== "excludes-ingredient")) return;
		const next = { ...f, ingredients: f.ingredients.filter((i) => i !== ingredient) };
		if (next.ingredients.length === 0) {
			removeFilter(filterKey);
		} else {
			activeFilters = new Map([...activeFilters, [filterKey, next]]);
		}
	}

	function toggleIngredientLogic(filterKey: string) {
		const f = activeFilters.get(filterKey) as HasIngredientFilter | undefined;
		if (!f || f.type !== "has-ingredient") return;
		activeFilters = new Map([...activeFilters, [filterKey, { ...f, logic: f.logic === "and" ? "or" : "and" }]]);
	}

	// ─── Group filter helpers ─────────────────────────────────────────────────
	function addGroupToFilter(filterKey: string, groupName: string) {
		const f = activeFilters.get(filterKey);
		if (!f || (f.type !== "has-group" && f.type !== "excludes-group")) return;
		if (f.groups.includes(groupName)) return;
		activeFilters = new Map([...activeFilters, [filterKey, { ...f, groups: [...f.groups, groupName] }]]);
	}

	function removeGroupFromFilter(filterKey: string, groupName: string) {
		const f = activeFilters.get(filterKey);
		if (!f || (f.type !== "has-group" && f.type !== "excludes-group")) return;
		const next = { ...f, groups: f.groups.filter((g) => g !== groupName) };
		if (next.groups.length === 0) {
			removeFilter(filterKey);
		} else {
			activeFilters = new Map([...activeFilters, [filterKey, next]]);
		}
	}

	function toggleGroupLogic(filterKey: string) {
		const f = activeFilters.get(filterKey) as HasGroupFilter | undefined;
		if (!f || f.type !== "has-group") return;
		activeFilters = new Map([...activeFilters, [filterKey, { ...f, logic: f.logic === "and" ? "or" : "and" }]]);
	}

	// ─── Auto-suggest state ───────────────────────────────────────────────────
	let suggestState = $state<{ filterKey: string; text: string; highlighted: number } | null>(null);

	let suggestions = $derived(
		suggestState
			? allIngredientNames.filter((n) => n.includes(suggestState!.text.toLowerCase())).slice(0, 8)
			: [],
	);

	function openSuggest(filterKey: string) {
		suggestState = { filterKey, text: "", highlighted: 0 };
	}

	function closeSuggest() {
		suggestState = null;
	}

	function selectSuggestion(ingredient: string) {
		if (!suggestState) return;
		addIngredientToFilter(suggestState.filterKey, ingredient);
		closeSuggest();
	}

	function handleSuggestKeydown(e: KeyboardEvent) {
		if (!suggestState) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			suggestState = { ...suggestState, highlighted: Math.min(suggestState.highlighted + 1, suggestions.length - 1) };
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			suggestState = { ...suggestState, highlighted: Math.max(suggestState.highlighted - 1, 0) };
		} else if (e.key === "Enter") {
			e.preventDefault();
			const sel = suggestions[suggestState.highlighted] ?? suggestState.text.trim();
			if (sel) selectSuggestion(sel);
		} else if (e.key === "Escape") {
			closeSuggest();
		}
	}

	function focusSelf(node: HTMLElement) {
		node.focus();
	}

	function recipeMatchesFilters(r: Recipe): boolean {
		for (const [key, filter] of activeFilters) {
			if (filter.type === "string") {
				if (!filter.value) continue;
				if (String(r[key] ?? "") !== filter.value) return false;
			} else if (filter.type === "numeric") {
				if (!filter.value) continue;
				const rNum = parseFloat(String(r[key] ?? ""));
				const fNum = parseFloat(filter.value);
				if (isNaN(rNum) || isNaN(fNum)) continue;
				if (filter.op === "<" && !(rNum < fNum)) return false;
				if (filter.op === "=" && rNum !== fNum) return false;
				if (filter.op === ">" && !(rNum > fNum)) return false;
			} else if (filter.type === "has-ingredient") {
				if (filter.ingredients.length === 0) continue;
				const inTexts = (recipeIngredientMap.get(r.path) ?? []).map((i) => i.text.toLowerCase());
				const matches = filter.ingredients.map((q) => inTexts.some((t) => t.includes(q)));
				if (!(filter.logic === "and" ? matches.every(Boolean) : matches.some(Boolean))) return false;
			} else if (filter.type === "excludes-ingredient") {
				if (filter.ingredients.length === 0) continue;
				const inTexts = (recipeIngredientMap.get(r.path) ?? []).map((i) => i.text.toLowerCase());
				if (filter.ingredients.some((q) => inTexts.some((t) => t.includes(q)))) return false;
			} else if (filter.type === "has-group") {
				if (filter.groups.length === 0) continue;
				const inTexts = (recipeIngredientMap.get(r.path) ?? []).map((i) => i.text.toLowerCase());
				const matches = filter.groups.map((gName) => {
					const g = ingredientGroups.find((ig: IngredientGroup) => ig.name === gName);
					return g ? g.keywords.some((kw: string) => inTexts.some((t) => t.includes(kw.toLowerCase()))) : false;
				});
				if (!(filter.logic === "and" ? matches.every(Boolean) : matches.some(Boolean))) return false;
			} else if (filter.type === "excludes-group") {
				if (filter.groups.length === 0) continue;
				const inTexts = (recipeIngredientMap.get(r.path) ?? []).map((i) => i.text.toLowerCase());
				for (const gName of filter.groups) {
					const g = ingredientGroups.find((ig: IngredientGroup) => ig.name === gName);
					if (g && g.keywords.some((kw: string) => inTexts.some((t) => t.includes(kw.toLowerCase())))) return false;
				}
			}
		}
		return true;
	}

	let filteredRecipes = $derived($recipes.filter(recipeMatchesFilters));

	let availableKeysToAdd = $derived(
		[...filterOptions.keys()].filter((k) => !activeFilters.has(k) && k !== HAS_INGREDIENT_KEY && k !== EXCLUDES_INGREDIENT_KEY && k !== HAS_GROUP_KEY && k !== EXCLUDES_GROUP_KEY),
	);

	// ─── Cook-soon toggle ─────────────────────────────────────────────────────
	function toggleCookSoon(path: string) {
		let toggled: Recipe | undefined;
		stores.recipes.update((list: Recipe[]) =>
			list.map((r: Recipe) => {
				if (r.path !== path) return r;
				toggled = { ...r, cook_soon: !r.cook_soon, [cookSoonProp]: !r[cookSoonProp] };
				return toggled;
			}),
		);
		if (toggled) void flushCookSoon(toggled, app, cookSoonProp);
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
			{#if filter.type === "has-ingredient" || filter.type === "excludes-ingredient"}
				<div class="filter-chip ingredient-filter-chip">
					<span class="filter-key">
						{filter.type === "has-ingredient" ? "must contain" : "excludes"}
					</span>
					{#if filter.type === "has-ingredient"}
						<button class="logic-toggle" onclick={() => toggleIngredientLogic(key)} title="Toggle AND/OR">
							{filter.logic.toUpperCase()}
						</button>
					{/if}
					{#each filter.ingredients as ingredient}
						<span class="ingredient-sub-chip">
							{ingredient}
							<button
								class="sub-chip-remove"
								aria-label="Remove {ingredient}"
								onclick={() => removeIngredientFromFilter(key, ingredient)}
							><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
						</span>
					{/each}
					{#if suggestState?.filterKey === key}
						<div class="suggest-wrapper">
							<input
								class="suggest-input"
								type="text"
								placeholder="Type ingredient…"
								value={suggestState.text}
								use:focusSelf
								oninput={(e) => {
									suggestState = { ...suggestState!, text: (e.currentTarget as HTMLInputElement).value, highlighted: 0 };
								}}
								onkeydown={handleSuggestKeydown}
								onblur={() => setTimeout(closeSuggest, 150)}
							/>
							{#if suggestions.length > 0}
								<ul class="suggest-dropdown">
									{#each suggestions as s, i}
										<li>
											<button
												class="suggest-item"
												class:highlighted={i === suggestState.highlighted}
												onmousedown={() => selectSuggestion(s)}
											>{s}</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{:else}
						<button class="add-ingredient-btn" onclick={() => openSuggest(key)} disabled={!ingredientsReady}>
							+ add
						</button>
					{/if}
					<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => removeFilter(key)}>
						<span use:obsidianIcon={"x"} aria-hidden="true"></span>
					</button>
				</div>
			{:else if filter.type === "has-group" || filter.type === "excludes-group"}
				<div class="filter-chip ingredient-filter-chip">
					<span class="filter-key">
						{filter.type === "has-group" ? "must contain group" : "excludes group"}
					</span>
					{#if filter.type === "has-group"}
						<button class="logic-toggle" onclick={() => toggleGroupLogic(key)} title="Toggle AND/OR">
							{filter.logic.toUpperCase()}
						</button>
					{/if}
					{#each filter.groups as groupName}
						<span class="ingredient-sub-chip">
							{groupName}
							<button
								class="sub-chip-remove"
								aria-label="Remove {groupName}"
								onclick={() => removeGroupFromFilter(key, groupName)}
							><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
						</span>
					{/each}
					<select
						class="group-add-select"
						onchange={(e) => {
							const val = (e.currentTarget as HTMLSelectElement).value;
							if (val) { addGroupToFilter(key, val); (e.currentTarget as HTMLSelectElement).value = ""; }
						}}
					>
						<option value="">+ add group…</option>
						{#each ingredientGroups.filter((g: IngredientGroup) => !filter.groups.includes(g.name)) as g}
							<option value={g.name}>{g.name}</option>
						{/each}
					</select>
					<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => removeFilter(key)}>
						<span use:obsidianIcon={"x"} aria-hidden="true"></span>
					</button>
				</div>
			{:else}
				<div class="filter-chip">
					<span class="filter-key">{key}</span>

					{#if filter.type === "numeric"}
						<select
							value={filter.op}
							onchange={(e) => setNumericOp(key, (e.currentTarget as HTMLSelectElement).value as "<" | "=" | ">")}
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
							oninput={(e) => setNumericValue(key, (e.currentTarget as HTMLInputElement).value)}
						/>
					{:else}
						<select
							value={filter.value}
							onchange={(e) => setStringValue(key, (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">Any</option>
							{#each filterOptions.get(key)?.values ?? [] as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					{/if}

					<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => removeFilter(key)}>
						<span use:obsidianIcon={"x"} aria-hidden="true"></span>
					</button>
				</div>
			{/if}
		{/each}

		<select
			class="add-filter-select"
			onchange={(e) => {
				addFilter((e.currentTarget as HTMLSelectElement).value);
				(e.currentTarget as HTMLSelectElement).value = "";
			}}
		>
			<option value="">+ Add filter…</option>
			{#if !activeFilters.has(HAS_INGREDIENT_KEY)}
				<option value={HAS_INGREDIENT_KEY} disabled={!ingredientsReady}>
					{ingredientsReady ? "Must contain ingredient" : "Must contain ingredient (loading…)"}
				</option>
			{/if}
			{#if !activeFilters.has(EXCLUDES_INGREDIENT_KEY)}
				<option value={EXCLUDES_INGREDIENT_KEY} disabled={!ingredientsReady}>
					{ingredientsReady ? "Excludes ingredient" : "Excludes ingredient (loading…)"}
				</option>
			{/if}
			{#if ingredientGroups.length > 0}
				{#if !activeFilters.has(HAS_GROUP_KEY)}
					<option value={HAS_GROUP_KEY}>Must contain group</option>
				{/if}
				{#if !activeFilters.has(EXCLUDES_GROUP_KEY)}
					<option value={EXCLUDES_GROUP_KEY}>Excludes group</option>
				{/if}
			{/if}
			{#each availableKeysToAdd as key}
				<option value={key}>{key}{filterOptions.get(key)?.isNumeric ? " (numeric)" : ""}</option>
			{/each}
		</select>
		{#if filterOptions.size === 0 && availableKeysToAdd.length === 0}
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
					{cookSoonProp}
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
		background: var(--background-secondary-alt);
		border: 1px solid var(--background-modifier-border);
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
		font-size: 0.8em;
		min-height: 44px;
		min-width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
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

	.ingredient-filter-chip {
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.logic-toggle {
		font-size: 0.75em;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-accent);
		cursor: pointer;
		line-height: 1.4;
	}

	.logic-toggle:hover {
		background: var(--background-modifier-hover);
	}

	.ingredient-sub-chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 1px 6px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 10px;
		font-size: 0.82em;
	}

	.sub-chip-remove {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.75em;
		padding: 0;
		display: flex;
		align-items: center;
		min-height: unset;
		min-width: unset;
	}

	.sub-chip-remove:hover {
		color: var(--text-error);
	}

	.add-ingredient-btn {
		font-size: 0.8em;
		padding: 1px 7px;
		border-radius: 10px;
		border: 1px dashed var(--background-modifier-border);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.add-ingredient-btn:hover:not(:disabled) {
		color: var(--text-normal);
		border-color: var(--text-muted);
	}

	.add-ingredient-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.group-add-select {
		font-size: 0.8em;
		padding: 1px 4px;
		border-radius: 10px;
		border: 1px dashed var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-muted);
		cursor: pointer;
	}

	.group-add-select:hover {
		color: var(--text-normal);
		border-color: var(--text-muted);
	}

	.suggest-wrapper {
		position: relative;
		display: inline-flex;
		flex-direction: column;
	}

	.suggest-input {
		font-size: 0.85em;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid var(--text-accent);
		background: var(--background-primary);
		width: 140px;
	}

	.suggest-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 100;
		margin: 2px 0 0;
		padding: 2px 0;
		list-style: none;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 160px;
		max-height: 200px;
		overflow-y: auto;
	}

	.suggest-dropdown li {
		list-style: none;
	}

	.suggest-item {
		display: block;
		width: 100%;
		padding: 4px 10px;
		font-size: 0.85em;
		cursor: pointer;
		white-space: nowrap;
		background: none;
		border: none;
		text-align: left;
		color: var(--text-normal);
	}

	.suggest-item:hover,
	.suggest-item.highlighted {
		background: var(--background-modifier-hover);
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
