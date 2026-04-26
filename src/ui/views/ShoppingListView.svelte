<script lang="ts">
	import { onDestroy } from "svelte";
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import type { RecipeStores } from "../../utils/recipeStores";
	import type { PersistedShoppingList, ShoppingItem, ShoppingCategory } from "../../types";
	import { assignCategory, formatQty } from "../../utils/recipeUtils";

	const { stores, saveShoppingList, getShoppingCategories } = $props<{
		stores: RecipeStores;
		saveShoppingList: (data: PersistedShoppingList) => Promise<void>;
		getShoppingCategories: () => ShoppingCategory[];
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

	// svelte-ignore state_referenced_locally — stores is a stable reference
	const hideCheckedItems = stores.hideCheckedItems;

	// ─── Grouped recipe items ─────────────────────────────────────────────────
	let allItems = $derived([...recipeItems, ...customItems]);
	let visibleItems = $derived($hideCheckedItems ? allItems.filter((i) => !i.checked) : allItems);
	let groups = $derived(buildGroups(visibleItems, categoryOrder));

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
	async function addCustomItem() {
		const text = newItemText.trim();
		if (!text) return;
		customItems = [
			...customItems,
			{
				id: `custom-${Date.now()}`,
				text,
				quantity: null,
				unit: null,
				checked: false,
				category: assignCategory(text, getShoppingCategories()),
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

	// ─── Keyboard category reorder ────────────────────────────────────────────
	async function moveCategory(category: string, dir: -1 | 1) {
		const idx = categoryOrder.indexOf(category);
		const target = idx + dir;
		if (target < 0 || target >= categoryOrder.length) return;
		const newOrder = [...categoryOrder];
		[newOrder[idx], newOrder[target]] = [newOrder[target]!, newOrder[idx]!];
		categoryOrder = newOrder;
		await persist();
	}

	// ─── Stats ────────────────────────────────────────────────────────────────
	let totalItems = $derived(allItems.length);
	let checkedCount = $derived(allItems.filter((i) => i.checked).length);

	let resetPending = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

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
			<button
				class="reset-btn"
				class:reset-confirm={resetPending}
				onclick={handleResetClick}
				title={resetPending ? "Click again to confirm" : "Clear shopping list"}
			>{#if !resetPending}<span use:obsidianIcon={"rotate-ccw"} aria-hidden="true"></span>{/if}{resetPending ? "Sure?" : "Reset"}</button>
		{/if}
	</div>

	<!-- Add custom item -->
	<div class="add-row">
		<label class="sr-only" for="shopping-add-input">Add item to list</label>
		<input
			id="shopping-add-input"
			bind:value={newItemText}
			placeholder="Add item (e.g. toothpaste)"
			onkeydown={(e) => e.key === "Enter" && addCustomItem()}
		/>
		<button onclick={addCustomItem}>Add</button>
	</div>

	{#if totalItems === 0}
		<p class="no-items-msg">
			No items yet. Add something above, or mark recipes as "cook soon" and click <strong
				>Generate Shopping List</strong
			> from the ribbon icon.
		</p>
	{:else}
		<!-- Recipe ingredient groups (draggable to reorder) -->
		{#each groups as group, i (group.category)}
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
					<span class="drag-handle" use:obsidianIcon={"grip-vertical"} aria-hidden="true"></span>
					<span class="category-name">{group.category}</span>
					<span class="category-count">
						{group.items.filter((i) => i.checked).length}/{group
							.items.length}
					</span>
					<div class="reorder-btns" role="group" aria-label="Reorder {group.category}">
						<button
							class="reorder-btn"
							aria-label="Move {group.category} up"
							disabled={i === 0}
							onclick={() => moveCategory(group.category, -1)}
						><span use:obsidianIcon={"chevron-up"} aria-hidden="true"></span></button>
						<button
							class="reorder-btn"
							aria-label="Move {group.category} down"
							disabled={i === groups.length - 1}
							onclick={() => moveCategory(group.category, 1)}
						><span use:obsidianIcon={"chevron-down"} aria-hidden="true"></span></button>
					</div>
				</div>
				<ul class="item-list">
					{#each group.items as item (item.id)}
						<li class:checked={item.checked}>
							<label class="item-label">
								<input
									type="checkbox"
									checked={item.checked}
									onchange={() => toggleItem(item)}
								/>
								<span class="item-content">
									<span class="item-text">
										{#if item.quantity !== null}{formatQty(item.quantity)}&nbsp;{/if}{#if item.unit}{item.unit}&nbsp;{/if}{item.text}
									</span>
									{#if item.prep}
										<span class="item-prep">{item.prep}</span>
									{/if}
									{#if item.recipeTitle}
										<span class="item-source">{item.recipeTitle}</span>
									{/if}
								</span>
							</label>
							{#if item.source === "custom"}
								<button
									class="remove-btn"
									onclick={() => removeCustomItem(item.id)}
									aria-label="Remove {item.text}"><span use:obsidianIcon={"x"} aria-hidden="true"></span></button>
							{/if}
						</li>
					{/each}
				</ul>
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
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.header h3 {
		margin: 0;
		flex: 1;
		font-size: 1.1em;
		font-weight: 600;
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

	.reorder-btns {
		display: flex;
		gap: 2px;
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
		min-height: 44px;
		min-width: 44px;
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
		align-items: flex-start;
		gap: 6px;
		padding: 3px 8px;
		font-size: 0.88em;
	}

	.item-list li:hover {
		background: var(--background-modifier-hover);
	}

	.item-label {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		flex: 1;
		cursor: pointer;
	}

	.item-content {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.item-text {
		overflow-wrap: break-word;
		word-break: break-word;
	}

	li.checked .item-text {
		text-decoration: line-through;
		color: var(--text-muted);
	}

	.item-prep {
		font-size: 0.78em;
		color: var(--text-muted);
	}

	.item-source {
		font-size: 0.75em;
		color: var(--text-faint);
		font-style: italic;
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
		gap: 6px;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.add-row input {
		flex: 1;
		font-size: 0.88em;
	}
</style>
