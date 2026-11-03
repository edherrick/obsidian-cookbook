import { TFile } from "obsidian";
import { get } from "svelte/store";
import type CookbookPlugin from "../main";
import { buildShoppingList } from "./build";
import { ShoppingListPersistence, parseShoppingListFromMarkdown } from "./persistence";
import { UNCATEGORIZED } from "../ingredients/categorize";
import { VIEW_TYPE_SHOPPING } from "../ui/views/CookbookShoppingView";
import type { ShoppingViewDeps } from "../ui/views/CookbookShoppingView";
import type { PersistedShoppingList, StoreLayout } from "../types";

/**
 * Owns the shopping list: generating it, keeping the shared store and the
 * saved copy in step, and the store layouts that order it.
 */
export class ShoppingListController {
	private readonly persistence: ShoppingListPersistence;

	constructor(private readonly plugin: CookbookPlugin) {
		this.persistence = new ShoppingListPersistence(
			{
				app: plugin.app,
				getFilePath: () => plugin.settings.shoppingListFilePath,
				loadData: () => plugin.readData(),
				saveData: (data) => plugin.saveData(data),
			},
			plugin.saveQueue,
		);
	}

	/** What the sidebar view needs from the plugin. */
	viewDeps(): ShoppingViewDeps {
		return {
			saveShoppingList: (data) => this.save(data),
			onReorder: (aisleOrder) => this.saveAisleOrder(aisleOrder),
			onSelectStore: (name) => this.selectStoreLayout(name),
			loadIfMissing: () => this.loadIfMissing(),
		};
	}

	async generate(): Promise<void> {
		const { app, settings, recipeStores } = this.plugin;
		// The store is kept current by every save and by edits to the note
		const existing = get(recipeStores.shoppingList);
		const route = this.activeLayout()?.aisleOrder ?? existing?.categoryOrder ?? [];
		const list = await buildShoppingList(app, get(recipeStores.recipes), settings.shoppingCategories, {
			cache: this.plugin.ingredientCache,
			unitPrefs: this.plugin.unitPrefs(),
			existingOrder: route,
			vocab: this.plugin.vocabulary,
		});

		// Preserve any custom items the user added before/between generations
		const preserved = existing?.items.filter((i) => i.source === "custom") ?? [];
		if (preserved.length > 0) list.items = [...list.items, ...preserved];

		await this.save(list);
		await this.openView();
	}

	save(data: PersistedShoppingList): Promise<void> {
		// Keep the store current so a reopened view doesn't show stale items
		this.plugin.recipeStores.shoppingList.set(data);
		return this.persistence.save(data);
	}

	/**
	 * Read the saved list into the store, but only while the store is empty.
	 * Once a list is loaded, the store is newer than disk (saves update it
	 * before their queued write lands), so a re-read could undo recent edits.
	 */
	async loadIfMissing(): Promise<void> {
		const store = this.plugin.recipeStores.shoppingList;
		if (get(store)) return;
		try {
			const persisted = await this.persistence.load();
			// Re-check: a list may have been generated or loaded during the read
			if (persisted && !get(store)) store.set(persisted);
		} catch (e) {
			console.warn("cookbook: failed to load shopping list", e);
		}
	}

	/** Pick up checkbox edits the user made directly in the shopping list note. */
	async syncFromFile(file: TFile): Promise<void> {
		if (file.path !== this.persistence.resolvePath()) return;
		const content = await this.plugin.app.vault.read(file);
		if (this.persistence.isOwnWrite(content)) return;
		const parsed = parseShoppingListFromMarkdown(content);
		if (parsed) this.plugin.recipeStores.shoppingList.set(parsed);
	}

	async openView(): Promise<void> {
		const { workspace } = this.plugin.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_SHOPPING);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_SHOPPING, active: true });
		await workspace.revealLeaf(leaf);
	}

	// ─── Store layouts ───────────────────────────────────────────────────────

	private activeLayout(): StoreLayout | undefined {
		const { storeLayouts, activeStoreLayout } = this.plugin.settings;
		return storeLayouts.find((l) => l.name === activeStoreLayout) ?? storeLayouts[0];
	}

	/**
	 * Remember a reordered route. Dragging categories in the shopping list is
	 * how a layout is edited, so the order is learned once and reused.
	 */
	private async saveAisleOrder(aisleOrder: string[]): Promise<void> {
		const layout = this.activeLayout();
		if (!layout) return;
		layout.aisleOrder = aisleOrder.filter((c) => c !== UNCATEGORIZED);
		await this.plugin.saveSettings();
	}

	private async selectStoreLayout(name: string): Promise<void> {
		this.plugin.settings.activeStoreLayout = name;
		await this.plugin.saveSettings();
	}
}
