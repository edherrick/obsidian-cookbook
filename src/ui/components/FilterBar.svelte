<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import IngredientSuggest from "./IngredientSuggest.svelte";
	import type { IngredientGroup } from "../../types";
	import type { FilterMeta, FilterValue } from "../../filters/model";
	import {
		EXCLUDES_GROUP_KEY,
		EXCLUDES_INGREDIENT_KEY,
		HAS_GROUP_KEY,
		HAS_INGREDIENT_KEY,
		SYNTHETIC_FILTER_KEYS,
		initialFilterFor,
	} from "../../filters/model";

	const {
		filters,
		filterOptions,
		ingredientGroups = [] as IngredientGroup[],
		allIngredientNames = [] as string[],
		ingredientsReady = false,
		onChange,
	} = $props<{
		filters: Map<string, FilterValue>;
		filterOptions: Map<string, FilterMeta>;
		ingredientGroups?: IngredientGroup[];
		allIngredientNames?: string[];
		ingredientsReady?: boolean;
		onChange: (next: Map<string, FilterValue>) => void;
	}>();

	let suggestFor = $state<string | null>(null);

	let availableKeysToAdd = $derived(
		[...filterOptions.keys()].filter(
			(k: string) => !filters.has(k) && !SYNTHETIC_FILTER_KEYS.includes(k),
		),
	);

	function set(key: string, value: FilterValue) {
		onChange(new Map([...filters, [key, value]]));
	}

	function remove(key: string) {
		const next = new Map(filters);
		next.delete(key);
		onChange(next);
	}

	function addFilter(key: string) {
		if (!key || filters.has(key)) return;
		set(key, initialFilterFor(key, filterOptions.get(key)));
	}

	// ─── Ingredient sub-chips ─────────────────────────────────────────────────
	function addIngredient(key: string, ingredient: string) {
		const f = filters.get(key);
		if (!f || (f.type !== "has-ingredient" && f.type !== "excludes-ingredient")) return;
		if (f.ingredients.includes(ingredient)) return;
		set(key, { ...f, ingredients: [...f.ingredients, ingredient] });
	}

	function removeIngredient(key: string, ingredient: string) {
		const f = filters.get(key);
		if (!f || (f.type !== "has-ingredient" && f.type !== "excludes-ingredient")) return;
		const ingredients = f.ingredients.filter((i: string) => i !== ingredient);
		if (ingredients.length === 0) remove(key);
		else set(key, { ...f, ingredients });
	}

	// ─── Group sub-chips ──────────────────────────────────────────────────────
	function addGroup(key: string, name: string) {
		const f = filters.get(key);
		if (!f || (f.type !== "has-group" && f.type !== "excludes-group")) return;
		if (f.groups.includes(name)) return;
		set(key, { ...f, groups: [...f.groups, name] });
	}

	function removeGroup(key: string, name: string) {
		const f = filters.get(key);
		if (!f || (f.type !== "has-group" && f.type !== "excludes-group")) return;
		const groups = f.groups.filter((g: string) => g !== name);
		if (groups.length === 0) remove(key);
		else set(key, { ...f, groups });
	}

	function toggleLogic(key: string) {
		const f = filters.get(key);
		if (!f || (f.type !== "has-ingredient" && f.type !== "has-group")) return;
		set(key, { ...f, logic: f.logic === "and" ? "or" : "and" });
	}
</script>

<div class="filter-bar">
	{#each [...filters] as [key, filter] (key)}
		{#if filter.type === "has-ingredient" || filter.type === "excludes-ingredient"}
			<div class="filter-chip ingredient-filter-chip">
				<span class="filter-key">
					{filter.type === "has-ingredient" ? "must contain" : "excludes"}
				</span>
				{#if filter.type === "has-ingredient"}
					<button class="logic-toggle" onclick={() => toggleLogic(key)} title="Toggle AND/OR">
						{filter.logic.toUpperCase()}
					</button>
				{/if}
				{#each filter.ingredients as ingredient (ingredient)}
					<span class="ingredient-sub-chip">
						{ingredient}
						<button
							class="sub-chip-remove"
							aria-label="Remove {ingredient}"
							onclick={() => removeIngredient(key, ingredient)}
						><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
					</span>
				{/each}
				{#if suggestFor === key}
					<IngredientSuggest
						names={allIngredientNames}
						onSelect={(name) => { addIngredient(key, name); suggestFor = null; }}
						onClose={() => (suggestFor = null)}
					/>
				{:else}
					<button
						class="add-ingredient-btn"
						onclick={() => (suggestFor = key)}
						disabled={!ingredientsReady}
					>+ add</button>
				{/if}
				<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => remove(key)}>
					<span use:obsidianIcon={"x"} aria-hidden="true"></span>
				</button>
			</div>
		{:else if filter.type === "has-group" || filter.type === "excludes-group"}
			<div class="filter-chip ingredient-filter-chip">
				<span class="filter-key">
					{filter.type === "has-group" ? "must contain group" : "excludes group"}
				</span>
				{#if filter.type === "has-group"}
					<button class="logic-toggle" onclick={() => toggleLogic(key)} title="Toggle AND/OR">
						{filter.logic.toUpperCase()}
					</button>
				{/if}
				{#each filter.groups as groupName (groupName)}
					<span class="ingredient-sub-chip">
						{groupName}
						<button
							class="sub-chip-remove"
							aria-label="Remove {groupName}"
							onclick={() => removeGroup(key, groupName)}
						><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
					</span>
				{/each}
				<select
					class="group-add-select"
					onchange={(e) => {
						const el = e.currentTarget as HTMLSelectElement;
						if (el.value) addGroup(key, el.value);
						el.value = "";
					}}
				>
					<option value="">+ add group…</option>
					{#each ingredientGroups.filter((g: IngredientGroup) => !filter.groups.includes(g.name)) as g (g.name)}
						<option value={g.name}>{g.name}</option>
					{/each}
				</select>
				<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => remove(key)}>
					<span use:obsidianIcon={"x"} aria-hidden="true"></span>
				</button>
			</div>
		{:else}
			<div class="filter-chip">
				<span class="filter-key">{key}</span>

				{#if filter.type === "numeric"}
					<select
						value={filter.op}
						onchange={(e) =>
							set(key, { ...filter, op: (e.currentTarget as HTMLSelectElement).value as "<" | "=" | ">" })}
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
						oninput={(e) => set(key, { ...filter, value: (e.currentTarget as HTMLInputElement).value })}
					/>
				{:else}
					<select
						value={filter.value}
						onchange={(e) =>
							set(key, { type: "string", value: (e.currentTarget as HTMLSelectElement).value })}
					>
						<option value="">Any</option>
						{#each filterOptions.get(key)?.values ?? [] as opt (opt)}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				{/if}

				<button class="filter-remove" aria-label="Remove {key} filter" onclick={() => remove(key)}>
					<span use:obsidianIcon={"x"} aria-hidden="true"></span>
				</button>
			</div>
		{/if}
	{/each}

	<select
		class="add-filter-select"
		onchange={(e) => {
			const el = e.currentTarget as HTMLSelectElement;
			addFilter(el.value);
			el.value = "";
		}}
	>
		<option value="">+ Add filter…</option>
		{#if !filters.has(HAS_INGREDIENT_KEY)}
			<option value={HAS_INGREDIENT_KEY} disabled={!ingredientsReady}>
				{ingredientsReady ? "Must contain ingredient" : "Must contain ingredient (loading…)"}
			</option>
		{/if}
		{#if !filters.has(EXCLUDES_INGREDIENT_KEY)}
			<option value={EXCLUDES_INGREDIENT_KEY} disabled={!ingredientsReady}>
				{ingredientsReady ? "Excludes ingredient" : "Excludes ingredient (loading…)"}
			</option>
		{/if}
		{#if ingredientGroups.length > 0}
			{#if !filters.has(HAS_GROUP_KEY)}
				<option value={HAS_GROUP_KEY}>Must contain group</option>
			{/if}
			{#if !filters.has(EXCLUDES_GROUP_KEY)}
				<option value={EXCLUDES_GROUP_KEY}>Excludes group</option>
			{/if}
		{/if}
		{#each availableKeysToAdd as key (key)}
			<option value={key}>{key}{filterOptions.get(key)?.isNumeric ? " (numeric)" : ""}</option>
		{/each}
	</select>

	{#if filterOptions.size === 0 && availableKeysToAdd.length === 0}
		<span class="filter-empty">No filterable properties found</span>
	{/if}

	{#if filters.size > 0}
		<button class="clear-filters" onclick={() => onChange(new Map())}>Clear all</button>
	{/if}
</div>

<style>
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

	.clear-filters {
		font-size: 0.8em;
		color: var(--text-muted);
		cursor: pointer;
		background: none;
		border: none;
		text-decoration: underline;
		margin-left: auto;
	}
</style>
