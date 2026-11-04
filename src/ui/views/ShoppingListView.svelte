<script lang="ts">
	import { onDestroy } from "svelte";
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import type { RecipeStores } from "../../recipes/recipeStores";
	import type {
		PersistedShoppingList,
		ShoppingItem,
		StoreLayout,
	} from "../../types";
	import { IngredientCatalog } from "../../ingredients/catalog";
	import { groupForStore } from "../../shopping/route";
	import { DOT_COLORS, recipeIndexes, splitDone } from "../../shopping/display";
	import { formatQty } from "../../ingredients/units";

	const {
		stores,
		saveShoppingList,
		onReorder,
		onSelectStore,
	} = $props<{
		stores: RecipeStores;
		saveShoppingList: (data: PersistedShoppingList) => Promise<void>;
		onReorder: (aisleOrder: string[]) => Promise<void>;
		onSelectStore: (name: string) => Promise<void>;
	}>();

	// ─── Local state ──────────────────────────────────────────────────────────
	let recipeItems: ShoppingItem[] = $state([]);
	let customItems: ShoppingItem[] = $state([]);
	let categoryOrder: string[] = $state([]);
	let generatedAt: number | null = $state(null);
	let newItemText = $state("");

	// Drag state
	let dragSource: string | null = $state(null);
	let dragOver: string | null = $state(null);

	// ─── Store layouts ────────────────────────────────────────────────────────
	// svelte-ignore state_referenced_locally — stores is a stable reference
	const settings = stores.settings;
	let layouts: StoreLayout[] = $derived($settings.storeLayouts);
	let activeStore = $derived($settings.activeStoreLayout ?? layouts[0]?.name ?? "");
	/** Files a typed-in item under its ingredient's category. */
	let catalog = $derived(
		new IngredientCatalog($settings.ingredients, $settings.shoppingCategories.map((c: { name: string }) => c.name)),
	);

	/**
	 * Switch shops. Categories the new route does not mention keep their place
	 * at the bottom — groupForStore appends anything the order list omits.
	 */
	async function selectStore(name: string) {
		await onSelectStore(name);
		const layout = layouts.find((l) => l.name === name);
		if (!layout) return;
		categoryOrder = [...layout.aisleOrder];
		await persist();
	}

	// ─── Subscribe to store (resets when a new list is generated) ────────────
	function applyList(list: PersistedShoppingList | null) {
		if (!list) return;
		recipeItems = list.items.filter((i) => i.source === "recipe");
		customItems = list.items.filter((i) => i.source === "custom");
		categoryOrder = [...list.categoryOrder];
		generatedAt = list.generatedAt;
	}

	// svelte-ignore state_referenced_locally — stores is a stable reference
	const unsubscribe = stores.shoppingList.subscribe(applyList);
	onDestroy(() => unsubscribe());

	// ─── Grouped recipe items ─────────────────────────────────────────────────
	let allItems = $derived([...recipeItems, ...customItems]);
	let visibleItems = $derived($settings.hideCheckedItems ? allItems.filter((i) => !i.checked) : allItems);
	let activeLayout = $derived(layouts.find((l) => l.name === activeStore));
	/** Numbered aisles for the active store first, then categories in route order. */
	let groups = $derived(
		groupForStore(visibleItems, {
			layout: activeLayout,
			categoryOrder,
			ingredientOf: (item) => catalog.ingredientFor(item.text)?.name,
		}),
	);
	// ─── Display ──────────────────────────────────────────────────────────────
	// svelte-ignore state_referenced_locally — stores is a stable reference
	const recipesStore = stores.recipes;
	/** Prep notes are for cooking, not shopping, so they're hidden unless asked for. */
	let showPrep = $state(false);
	/** Groups whose checked items are shown; otherwise they fold into "N done". */
	let openDone: string[] = $state([]);

	/** Recipes on this list, in the order their items first appear; each gets a dot colour. */
	let listTitles = $derived.by(() => {
		const titles = $recipesStore.map((r: { title?: unknown }) => String(r.title ?? "")).filter(Boolean);
		const seen: string[] = [];
		for (const item of allItems) {
			for (const i of recipeIndexes(item.recipeTitle, titles)) {
				if (!seen.includes(titles[i]!)) seen.push(titles[i]!);
			}
		}
		return seen;
	});
	const dotColor = (i: number) => `var(--color-${DOT_COLORS[i % DOT_COLORS.length]})`;

	function toggleDone(key: string) {
		openDone = openDone.includes(key) ? openDone.filter((k) => k !== key) : [...openDone, key];
	}

	/** Only category groups can be reordered; an aisle's number fixes its place. */
	let categoryGroups = $derived(groups.filter((g) => g.category !== undefined));

	// ─── Persistence ─────────────────────────────────────────────────────────
	async function persist() {
		await saveShoppingList({
			items: allItems,
			categoryOrder,
			generatedAt: generatedAt ?? Date.now(),
		});
	}

	// ─── Item toggle ─────────────────────────────────────────────────────────
	async function toggleItem(item: ShoppingItem) {
		if (item.source === "custom") {
			customItems = customItems.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i);
		} else {
			recipeItems = recipeItems.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i);
		}
		await persist();
	}

	// ─── Custom items ─────────────────────────────────────────────────────────
	let customIdCounter = 0;

	async function addCustomItem() {
		const text = newItemText.trim();
		if (!text) return;
		customItems = [
			...customItems,
			{
				id: `custom-${Date.now()}-${customIdCounter++}`,
				text,
				quantity: null,
				unit: null,
				checked: false,
				category: catalog.categoryFor(text),
				source: "custom",
			},
		];
		newItemText = "";
		await persist();
	}

	async function removeCustomItem(id: string) {
		customItems = customItems.filter((i) => i.id !== id);
		await persist();
	}

	// ─── Category drag-and-drop ───────────────────────────────────────────────
	function onDragStart(e: DragEvent, category: string) {
		dragSource = category;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	}

	function onDragOver(e: DragEvent, category: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		dragOver = category;
	}

	function onDragLeave() {
		dragOver = null;
	}

	async function onDrop(e: DragEvent, target: string) {
		e.preventDefault();
		dragOver = null;
		const moved = dragSource;
		dragSource = null;
		if (!moved || moved === target) return;
		await reorderCategory(moved, target);
	}

	function onDragEnd() {
		dragSource = null;
		dragOver = null;
	}

	// ─── Category reorder ─────────────────────────────────────────────────────

	/**
	 * Place `moved` where `target` currently sits.
	 *
	 * Either category may be missing from categoryOrder — a category can come
	 * from a renamed setting, or from an item the order list has never seen —
	 * so both are appended before the move rather than silently doing nothing.
	 */
	async function reorderCategory(moved: string, target: string) {
		const order = [...categoryOrder];
		for (const c of [moved, target]) if (!order.includes(c)) order.push(c);
		const from = order.indexOf(moved);
		const to = order.indexOf(target);
		if (from === -1 || to === -1 || from === to) return;
		order.splice(from, 1);
		order.splice(to, 0, moved);
		categoryOrder = order;
		await Promise.all([persist(), onReorder(order)]);
	}

	/**
	 * Step a category past its neighbour *in the rendered list*.
	 *
	 * categoryOrder also holds categories with no items in this list, which are
	 * not rendered. Stepping through those positions looked like the button was
	 * doing nothing, so the move is anchored to the visible group instead.
	 */
	async function moveCategory(category: string, dir: -1 | 1) {
		const visible = categoryGroups.map((g) => g.category!);
		const neighbour = visible[visible.indexOf(category) + dir];
		if (neighbour === undefined) return;
		await reorderCategory(category, neighbour);
	}

	// ─── Stats ────────────────────────────────────────────────────────────────
	let totalItems = $derived(allItems.length);
	let checkedCount = $derived(allItems.filter((i) => i.checked).length);
	let progress = $derived(totalItems === 0 ? 0 : Math.round((checkedCount / totalItems) * 100));

	let resetPending = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	onDestroy(() => {
		if (resetTimer) clearTimeout(resetTimer);
	});

	function handleResetClick() {
		if (!resetPending) {
			resetPending = true;
			resetTimer = setTimeout(() => { resetPending = false; }, 3000);
			return;
		}
		if (resetTimer) clearTimeout(resetTimer);
		resetPending = false;
		void resetList();
	}

	async function resetList() {
		recipeItems = [];
		customItems = [];
		categoryOrder = [];
		generatedAt = null;
		stores.shoppingList.set(null);
		await saveShoppingList({
			items: [],
			categoryOrder: [],
			generatedAt: 0,
		});
	}
</script>

{#snippet itemRow(item: ShoppingItem)}
	{@const dots = recipeIndexes(item.recipeTitle, listTitles)}
	<li class:checked={item.checked}>
		<label class="item-label">
			<input type="checkbox" checked={item.checked} onchange={() => toggleItem(item)} />
			<span class="item-content">
				<span class="item-line">
					{#if item.quantity !== null || item.unit}
						<span class="item-qty">{#if item.quantity !== null}{formatQty(item.quantity)}{/if}{#if item.unit}&nbsp;{item.unit}{/if}</span>
					{/if}
					<span class="item-text">{item.text}</span>
				</span>
				{#if showPrep && item.prep}
					<span class="item-prep">{item.prep}</span>
				{/if}
			</span>
		</label>
		{#if dots.length > 0}
			<span class="item-dots" title={item.recipeTitle} aria-label="From {item.recipeTitle}">
				{#each dots as d (d)}
					<span class="dot" style:--dot={dotColor(d)}></span>
				{/each}
			</span>
		{/if}
		{#if item.source === "custom"}
			<button class="remove-btn" onclick={() => removeCustomItem(item.id)} aria-label="Remove {item.text}"
				><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
		{/if}
	</li>
{/snippet}

<div class="shopping-list-view">
	<div class="header">
		<div class="title-row">
			<h3>Shopping list</h3>
			{#if layouts.length > 1}
				<label class="sr-only" for="shopping-store-select">Store layout</label>
				<select
					id="shopping-store-select"
					class="store-select dropdown"
					value={activeStore}
					onchange={(e) => selectStore((e.currentTarget as HTMLSelectElement).value)}
					title="Order the list by this shop's aisles"
				>
					{#each layouts as l (l.name)}
						<option value={l.name}>{l.name}</option>
					{/each}
				</select>
			{/if}
			{#if totalItems > 0}
				<button
					class="clickable-icon"
					class:is-active={showPrep}
					aria-pressed={showPrep}
					aria-label={showPrep ? "Hide prep notes" : "Show prep notes"}
					title={showPrep ? "Hide prep notes" : "Show prep notes"}
					onclick={() => (showPrep = !showPrep)}
				><span use:obsidianIcon={"list"} aria-hidden="true"></span></button>
				<button
					class="clickable-icon reset-btn"
					class:reset-confirm={resetPending}
					onclick={handleResetClick}
					aria-label={resetPending ? "Click again to clear the list" : "Clear shopping list"}
					title={resetPending ? "Click again to clear the list" : "Clear shopping list"}
				>{#if resetPending}Sure?{:else}<span use:obsidianIcon={"rotate-ccw"} aria-hidden="true"></span>{/if}</button>
			{/if}
		</div>
		{#if totalItems > 0}
			<div class="progress-row">
				<div
					class="progress-bar"
					role="progressbar"
					aria-label="Items checked"
					aria-valuemin={0}
					aria-valuemax={totalItems}
					aria-valuenow={checkedCount}
				>
					<div class="progress-fill" style:width="{progress}%"></div>
				</div>
				<span class="progress-text">
					{checkedCount} of {totalItems}{#if generatedAt}&nbsp;· <span
							class="generated-at"
							title="Generated {new Date(generatedAt).toLocaleString()}"
							>{new Date(generatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span
						>{/if}
				</span>
			</div>
		{/if}
	</div>

	<!-- Add custom item -->
	<div class="add-row">
		<label class="sr-only" for="shopping-add-input">Add item to list</label>
		<input
			id="shopping-add-input"
			type="text"
			bind:value={newItemText}
			placeholder="Add an item"
			onkeydown={(e) => e.key === "Enter" && addCustomItem()}
		/>
		<button class="clickable-icon add-btn" aria-label="Add item" onclick={addCustomItem}
			><span use:obsidianIcon={"plus"} aria-hidden="true"></span></button>
	</div>

	{#if listTitles.length > 0}
		<div class="legend" aria-label="Recipes on this list">
			{#each listTitles as title, i (title)}
				<span class="legend-item"><span class="dot" style:--dot={dotColor(i)}></span>{title}</span>
			{/each}
		</div>
	{/if}

	{#if totalItems === 0}
		<p class="no-items-msg">
			No items yet. Add something above, or mark recipes as "cook soon" and click <strong
				>Generate Shopping List</strong
			> from the ribbon icon.
		</p>
	{:else}
		<!-- Aisles in number order, then categories (draggable to reorder) -->
		{#each groups as group (group.key)}
			{@const category = group.category}
			{@const ci = category === undefined ? -1 : categoryGroups.indexOf(group)}
			{@const split = splitDone(group.items)}
			{@const doneOpen = openDone.includes(group.key)}
			{@const finished = split.todo.length === 0}
			<div
				class="category-group"
				class:aisle-group={category === undefined}
				class:is-finished={finished}
				class:drag-over={category !== undefined && dragOver === category}
				class:dragging={category !== undefined && dragSource === category}
				draggable={category !== undefined}
				ondragstart={(e) => category !== undefined && onDragStart(e, category)}
				ondragover={(e) => category !== undefined && onDragOver(e, category)}
				ondragleave={onDragLeave}
				ondrop={(e) => category !== undefined && onDrop(e, category)}
				ondragend={onDragEnd}
				role="listitem"
			>
				<div class="category-header">
					{#if category !== undefined}
						<span class="drag-handle" use:obsidianIcon={"grip-vertical"} aria-hidden="true"></span>
					{/if}
					<span class="category-name">{group.label}</span>
					{#if group.detail}
						<span class="aisle-detail">{group.detail}</span>
					{/if}
					<span class="category-count">
						{#if finished}
							<span class="done-mark" use:obsidianIcon={"check"} aria-label="All done"></span>
						{:else}
							{split.done.length}/{group.items.length}
						{/if}
					</span>
					{#if category !== undefined}
						<div class="reorder-btns" role="group" aria-label="Reorder {category}">
							<button
								class="reorder-btn"
								aria-label="Move {category} up"
								disabled={ci === 0}
								onclick={() => moveCategory(category, -1)}
							><span use:obsidianIcon={"chevron-up"} aria-hidden="true"></span></button>
							<button
								class="reorder-btn"
								aria-label="Move {category} down"
								disabled={ci === categoryGroups.length - 1}
								onclick={() => moveCategory(category, 1)}
							><span use:obsidianIcon={"chevron-down"} aria-hidden="true"></span></button>
						</div>
					{/if}
				</div>
				{#if split.todo.length > 0}
					<ul class="item-list">
						{#each split.todo as item (item.id)}
							{@render itemRow(item)}
						{/each}
					</ul>
				{/if}
				{#if split.done.length > 0}
					<button class="done-toggle" aria-expanded={doneOpen} onclick={() => toggleDone(group.key)}>
						<span use:obsidianIcon={doneOpen ? "chevron-down" : "chevron-right"} aria-hidden="true"></span>
						{split.done.length} done
					</button>
					{#if doneOpen}
						<ul class="item-list done-list">
							{#each split.done as item (item.id)}
								{@render itemRow(item)}
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	.shopping-list-view {
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--size-4-1);
		min-width: 0;
	}


	.header h3 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--font-ui-medium);
		font-weight: var(--font-semibold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title-row > :global(.clickable-icon),
	.title-row > select {
		flex-shrink: 0;
	}

	.store-select {
		font-size: 0.78em;
		max-width: 10rem;
		border-radius: 3px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		padding: 1px 4px;
		cursor: pointer;
	}

	.generated-at {
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
		white-space: nowrap;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.progress-bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--background-modifier-border);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--interactive-accent);
	}

	@media (prefers-reduced-motion: no-preference) {
		.progress-fill {
			transition: width 0.2s;
		}
	}

	.progress-text {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.reset-btn {
		white-space: nowrap;
		font-size: var(--font-ui-smaller);
	}

	.clickable-icon.is-active {
		color: var(--text-accent);
	}

	.reset-btn:hover,
	.reset-btn.reset-confirm {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.no-items-msg {
		color: var(--text-muted);
		font-size: 0.9em;
		text-align: center;
		padding: 2rem 1rem;
		line-height: 1.6;
	}

	.category-group {
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
	}

	@media (prefers-reduced-motion: no-preference) {
		.category-group {
			transition: border-color 0.15s, opacity 0.15s;
		}
	}

	.category-group.drag-over {
		border-color: var(--text-accent);
		background: var(--background-modifier-hover);
	}

	.category-group.dragging {
		opacity: 0.5;
	}

	/* Stays in view while scrolling through its aisle */
	.category-header {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 5px 8px;
		background: var(--background-secondary);
		font-weight: 600;
		font-size: 0.82em;
		user-select: none;
		cursor: grab;
		border-radius: 5px 5px 0 0;
	}

	.category-group.is-finished .category-header {
		border-radius: 5px;
		color: var(--text-muted);
	}

	.done-mark {
		display: inline-flex;
		color: var(--color-green);
		--icon-size: 14px;
	}

	/* Float over the heading on hover, so hidden buttons take no width */
	.reorder-btns {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		gap: 2px;
		padding-left: 4px;
		background: var(--background-secondary);
		opacity: 0;
		transition: opacity 0.1s;
	}

	.category-header:focus-within .reorder-btns,
	.category-header:hover .reorder-btns {
		opacity: 1;
	}

	.reorder-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.85em;
		border-radius: 3px;
		line-height: 1;
		min-height: 28px;
		min-width: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reorder-btn:hover:not(:disabled) {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}

	.reorder-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.drag-handle {
		color: var(--text-faint);
		font-size: 0.9em;
	}

	.category-name {
		flex: 1;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.8em;
	}

	.aisle-group .category-header {
		cursor: default;
	}

	.aisle-group .category-name {
		flex: none;
	}

	.aisle-detail {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: normal;
		font-size: 0.8em;
		color: var(--text-muted);
	}

	.category-count {
		font-size: 0.8em;
		color: var(--text-muted);
		font-weight: normal;
	}

	.item-list {
		list-style: none;
		margin: 0;
		padding: 2px 0 6px;
	}

	.item-list li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px;
		font-size: 0.9em;
	}

	.item-list li:hover {
		background: var(--background-modifier-hover);
	}

	.item-label {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}

	.item-content {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	/* Flows like a sentence, so a narrow sidebar wraps between words */
	.item-line {
		min-width: 0;
		overflow-wrap: break-word;
	}

	.item-qty {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
		margin-right: 0.35em;
	}

	li.checked .item-text,
	li.checked .item-qty {
		text-decoration: line-through;
		color: var(--text-faint);
	}

	.item-prep {
		font-size: 0.8em;
		color: var(--text-muted);
	}

	/* One dot per recipe the item came from; names on hover */
	.item-dots {
		display: inline-flex;
		gap: 3px;
		flex-shrink: 0;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
		flex-shrink: 0;
	}

	.legend {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.done-toggle {
		all: unset;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px 6px;
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
		cursor: pointer;
		--icon-size: 12px;
	}

	.done-toggle:hover,
	.done-toggle:focus-visible {
		color: var(--text-muted);
	}

	.done-list {
		padding-top: 0;
	}


	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.75em;
		opacity: 0.3;
		line-height: 1;
		min-height: 44px;
		min-width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.remove-btn {
			transition: opacity 0.1s;
		}
	}

	li:hover .remove-btn,
	.remove-btn:focus {
		opacity: 1;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.add-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.add-row input {
		flex: 1;
		min-width: 0;
		font-size: 0.9em;
	}
</style>
