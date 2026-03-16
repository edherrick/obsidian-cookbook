<script lang="ts">
	import { onDestroy } from "svelte";
	import type { RecipeStores } from "../../utils/recipeStores";
	import type { PersistedShoppingList, ShoppingItem } from "../../types";

	const { stores, saveShoppingList } = $props<{
		stores: RecipeStores;
		saveShoppingList: (data: PersistedShoppingList) => Promise<void>;
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
	let groups = $derived(buildGroups(recipeItems, categoryOrder));

	function buildGroups(
		items: ShoppingItem[],
		order: string[],
	): { category: string; items: ShoppingItem[] }[] {
		const byCategory = new Map<string, ShoppingItem[]>();
		for (const item of items) {
			const cat = item.category || "Uncategorized";
			if (!byCategory.has(cat)) byCategory.set(cat, []);
			byCategory.get(cat)!.push(item);
		}
		const result: { category: string; items: ShoppingItem[] }[] = [];
		for (const cat of order) {
			const catItems = byCategory.get(cat);
			if (catItems) {
				result.push({ category: cat, items: catItems });
				byCategory.delete(cat);
			}
		}
		// Anything not in the order list goes at the bottom
		for (const [cat, catItems] of byCategory) {
			result.push({ category: cat, items: catItems });
		}
		return result;
	}

	// ─── Persistence ─────────────────────────────────────────────────────────
	async function persist() {
		await saveShoppingList({
			items: [...recipeItems, ...customItems],
			categoryOrder,
			generatedAt: generatedAt ?? Date.now(),
		});
	}

	// ─── Recipe item toggle ───────────────────────────────────────────────────
	async function toggleRecipeItem(id: string) {
		recipeItems = recipeItems.map((i) =>
			i.id === id ? { ...i, checked: !i.checked } : i,
		);
		await persist();
	}

	// ─── Custom items ─────────────────────────────────────────────────────────
	async function addCustomItem() {
		const text = newItemText.trim();
		if (!text) return;
		customItems = [
			...customItems,
			{
				id: `custom-${Date.now()}`,
				text,
				quantity: null,
				checked: false,
				category: "Custom",
				source: "custom",
			},
		];
		newItemText = "";
		await persist();
	}

	async function toggleCustomItem(id: string) {
		customItems = customItems.map((i) =>
			i.id === id ? { ...i, checked: !i.checked } : i,
		);
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
		if (!dragSource || dragSource === target) {
			dragSource = null;
			return;
		}
		const from = categoryOrder.indexOf(dragSource);
		const to = categoryOrder.indexOf(target);
		if (from === -1 || to === -1) {
			dragSource = null;
			return;
		}
		const newOrder = [...categoryOrder];
		newOrder.splice(from, 1);
		newOrder.splice(to, 0, dragSource);
		categoryOrder = newOrder;
		dragSource = null;
		await persist();
	}

	function onDragEnd() {
		dragSource = null;
		dragOver = null;
	}

	// ─── Stats ────────────────────────────────────────────────────────────────
	let totalItems = $derived(recipeItems.length + customItems.length);
	let checkedCount = $derived(
		recipeItems.filter((i) => i.checked).length +
			customItems.filter((i) => i.checked).length,
	);

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

<div class="shopping-list-view">
	<div class="header">
		<h3>Shopping List</h3>
		{#if generatedAt}
			<span class="generated-at"
				>{new Date(generatedAt).toLocaleDateString()}</span
			>
		{/if}
		{#if totalItems > 0}
			<span class="progress">{checkedCount}/{totalItems}</span>
			<button class="reset-btn" onclick={resetList} title="Clear shopping list">
				↺ Reset
			</button>
		{/if}
	</div>

	{#if totalItems === 0}
		<p class="empty-state">
			No items yet.<br />Mark recipes as "cook soon" and click <strong
				>Generate Shopping List</strong
			> from the ribbon icon.
		</p>
	{:else}
		<!-- Recipe ingredient groups (draggable to reorder) -->
		{#each groups as group (group.category)}
			<div
				class="category-group"
				class:drag-over={dragOver === group.category}
				class:dragging={dragSource === group.category}
				draggable="true"
				ondragstart={(e) => onDragStart(e, group.category)}
				ondragover={(e) => onDragOver(e, group.category)}
				ondragleave={onDragLeave}
				ondrop={(e) => onDrop(e, group.category)}
				ondragend={onDragEnd}
				role="listitem"
			>
				<div class="category-header">
					<span class="drag-handle" aria-hidden="true">⠿</span>
					<span class="category-name">{group.category}</span>
					<span class="category-count">
						{group.items.filter((i) => i.checked).length}/{group
							.items.length}
					</span>
				</div>
				<ul class="item-list">
					{#each group.items as item (item.id)}
						<li class:checked={item.checked}>
							<input
								type="checkbox"
								checked={item.checked}
								onchange={() => toggleRecipeItem(item.id)}
							/>
							<span class="item-text">
								{#if item.quantity !== null}{item.quantity}&nbsp;{/if}{item.text}
							</span>
							{#if item.recipeTitle}
								<span class="item-source"
									>{item.recipeTitle}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}

		<!-- Custom items section -->
		{#if customItems.length > 0}
			<div class="category-group custom-group">
				<div class="category-header">
					<span class="category-name">Other / Custom</span>
					<span class="category-count">
						{customItems.filter((i) => i.checked).length}/{customItems.length}
					</span>
				</div>
				<ul class="item-list">
					{#each customItems as item (item.id)}
						<li class:checked={item.checked}>
							<input
								type="checkbox"
								checked={item.checked}
								onchange={() => toggleCustomItem(item.id)}
							/>
							<span class="item-text">{item.text}</span>
							<button
								class="remove-btn"
								onclick={() => removeCustomItem(item.id)}
								aria-label="Remove item">✕</button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	<!-- Add custom item -->
	<div class="add-row">
		<input
			bind:value={newItemText}
			placeholder="Add item (e.g. toothpaste)"
			onkeydown={(e) => e.key === "Enter" && addCustomItem()}
		/>
		<button onclick={addCustomItem}>Add</button>
	</div>
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
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.header h3 {
		margin: 0;
		flex: 1;
		font-size: 1em;
	}

	.generated-at {
		font-size: 0.75em;
		color: var(--text-muted);
	}

	.progress {
		font-size: 0.85em;
		color: var(--text-accent);
		font-weight: 600;
	}

	.reset-btn {
		font-size: 0.78em;
		padding: 1px 6px;
		background: none;
		border: 1px solid var(--background-modifier-border);
		border-radius: 3px;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.reset-btn:hover {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.empty-state {
		color: var(--text-muted);
		font-size: 0.9em;
		text-align: center;
		padding: 2rem 1rem;
		line-height: 1.6;
	}

	.category-group {
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		transition: border-color 0.15s, opacity 0.15s;
	}

	.category-group.drag-over {
		border-color: var(--text-accent);
		background: var(--background-modifier-hover);
	}

	.category-group.dragging {
		opacity: 0.5;
	}

	.category-header {
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
		font-size: 0.88em;
	}

	.item-list li:hover {
		background: var(--background-modifier-hover);
	}

	.item-text {
		flex: 1;
	}

	li.checked .item-text {
		text-decoration: line-through;
		color: var(--text-muted);
	}

	.item-source {
		font-size: 0.75em;
		color: var(--text-faint);
		font-style: italic;
		white-space: nowrap;
	}

	.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.75em;
		padding: 0 2px;
		opacity: 0;
		transition: opacity 0.1s;
		line-height: 1;
	}

	li:hover .remove-btn {
		opacity: 1;
	}

	.add-row {
		display: flex;
		gap: 6px;
		padding-top: 0.5rem;
		border-top: 1px solid var(--background-modifier-border);
		margin-top: auto;
	}

	.add-row input {
		flex: 1;
		font-size: 0.88em;
	}
</style>
