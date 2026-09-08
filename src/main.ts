import { Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { get } from "svelte/store";
import { CookbookSettingTab } from "./settings/settingsTab";
import { mergeSettings } from "./settings";
import type { CookbookSettings } from "./settings";
import { SvelteModalWrapper } from "./utils/SvelteModalWrapper";
import { SerialQueue } from "./utils/serialQueue";
import CookbookRibbonModal from "./ui/modals/CookbookRibbonModal.svelte";
import RecipesModal from "./ui/modals/RecipesModal.svelte";
import { VIEW_TYPE_SHOPPING, CookbookShoppingView } from "./ui/views/CookbookShoppingView";
import { getRecipes } from "./recipes/repository";
import type { Recipe } from "./recipes/repository";
import { createRecipeStores } from "./recipes/recipeStores";
import type { RecipeStores } from "./recipes/recipeStores";
import { IngredientCache } from "./ingredients/cache";
import { buildShoppingList } from "./shopping/build";
import { ShoppingListPersistence } from "./shopping/persistence";
import type { PersistedShoppingList } from "./types";

/** Frontmatter edits arrive in bursts; rescanning once per burst is enough. */
const RECIPE_REFRESH_DEBOUNCE_MS = 500;

export default class CookbookPlugin extends Plugin {
	settings: CookbookSettings;
	recipeStores: RecipeStores;

	private ingredientCache = new IngredientCache();
	private saveQueue = new SerialQueue();
	private shoppingList: ShoppingListPersistence;
	private refreshRecipesDebounced: () => void;

	async onload() {
		await this.loadSettings();

		this.recipeStores = createRecipeStores(this.settings.hideCheckedItems);
		this.shoppingList = new ShoppingListPersistence(
			{
				app: this.app,
				getFilePath: () => this.settings.shoppingListFilePath,
				loadData: async () => ((await this.loadData()) ?? {}) as Record<string, unknown>,
				saveData: (data) => this.saveData(data),
			},
			this.saveQueue,
		);
		this.refreshRecipesDebounced = debounce(
			() => void this.refreshRecipes(),
			RECIPE_REFRESH_DEBOUNCE_MS,
			false,
		);

		// The metadata cache may still be warming up during onload
		this.app.workspace.onLayoutReady(() => void this.refreshRecipes());

		try {
			const persisted = await this.shoppingList.load();
			if (persisted) this.recipeStores.shoppingList.set(persisted);
		} catch (e) {
			console.warn("Failed to load shopping list on load", e);
		}

		this.registerView(
			VIEW_TYPE_SHOPPING,
			(leaf: WorkspaceLeaf) =>
				new CookbookShoppingView(
					leaf,
					this.recipeStores,
					(data) => this.saveShoppingList(data),
					() => this.settings.shoppingCategories,
				),
		);

		this.addCommand({
			id: "open-shopping-view",
			name: "Open shopping list",
			callback: () => void this.openShoppingListView(),
		});

		this.addCommand({
			id: "browse",
			name: "Browse recipes",
			callback: () => this.openRecipesModal(),
		});

		this.addRibbonIcon("utensils", "Cookbook", () => {
			new SvelteModalWrapper(this.app, CookbookRibbonModal, {
				openRecipeModal: () => this.openRecipesModal(),
				generateShoppingList: () => this.generateShoppingList(),
				refreshRecipes: () => this.refreshRecipes(),
				stores: this.recipeStores,
				app: this.app,
				cookSoonProp: this.settings.cookSoonProp,
			}).open();
		});

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!(file instanceof TFile)) return;
				this.ingredientCache.invalidate(file.path);
				void this.syncShoppingListFromFile(file);
			}),
		);

		// Frontmatter and tag edits change which notes count as recipes
		this.registerEvent(
			this.app.metadataCache.on("changed", () => this.refreshRecipesDebounced()),
		);

		this.addSettingTab(new CookbookSettingTab(this.app, this));
	}

	onunload() {
		this.ingredientCache.invalidate();
	}

	// ─── Recipes ─────────────────────────────────────────────────────────────

	/** Rescan the vault, preserving in-session multipliers. */
	async refreshRecipes(): Promise<void> {
		try {
			const fresh = await getRecipes(
				this.app,
				this.settings.cookSoonProp,
				this.settings.ignorePaths,
				this.settings.recipesFolder,
				this.settings.recipesTag,
			);
			this.recipeStores.recipes.update((current: Recipe[]) => {
				const multipliers = new Map(current.map((r) => [r.path, r.cook_multiplier]));
				return fresh.map((r) => ({ ...r, cook_multiplier: multipliers.get(r.path) ?? 1 }));
			});
		} catch (e) {
			console.warn("cookbook: failed to refresh recipes", e);
		}
	}

	private openRecipesModal(): void {
		new SvelteModalWrapper(this.app, RecipesModal, {
			app: this.app,
			stores: this.recipeStores,
			ingredientCache: this.ingredientCache,
			propsToShow: this.settings.propsToShow,
			cookSoonProp: this.settings.cookSoonProp,
			coverProp: this.settings.coverProp,
			ingredientGroups: this.settings.ingredientGroups,
		}).open();
	}

	// ─── Shopping list ───────────────────────────────────────────────────────

	private async generateShoppingList(): Promise<void> {
		// Read back from storage rather than the store: the shopping list view
		// persists reorders and check-offs straight to disk, so the store can be
		// behind, and a stale read here would undo a hand-sorted category order.
		const existing = (await this.shoppingList.load()) ?? get(this.recipeStores.shoppingList);
		const list = await buildShoppingList(
			this.app,
			get(this.recipeStores.recipes),
			this.settings.shoppingCategories,
			{
				cache: this.ingredientCache,
				unitPrefs: {
					preferredVolumeUnit: this.settings.preferredVolumeUnit,
					preferredWeightUnit: this.settings.preferredWeightUnit,
				},
				existingOrder: existing?.categoryOrder ?? [],
			},
		);

		// Preserve any custom items the user added before/between generations
		const preserved = existing?.items.filter((i) => i.source === "custom") ?? [];
		if (preserved.length > 0) list.items = [...list.items, ...preserved];

		this.recipeStores.shoppingList.set(list);
		await this.saveShoppingList(list);
		await this.openShoppingListView();
	}

	/** Pick up checkbox edits the user made directly in the shopping list note. */
	private async syncShoppingListFromFile(file: TFile): Promise<void> {
		if (file.path !== this.shoppingList.resolvePath()) return;
		const content = await this.app.vault.read(file);
		if (this.shoppingList.isOwnWrite(content)) return;
		const parsed = await this.shoppingList.load();
		if (parsed) this.recipeStores.shoppingList.set(parsed);
	}

	async openShoppingListView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SHOPPING);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_SHOPPING, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	saveShoppingList(data: PersistedShoppingList): Promise<void> {
		return this.shoppingList.save(data);
	}

	// ─── Settings ────────────────────────────────────────────────────────────

	async loadSettings(): Promise<void> {
		this.settings = mergeSettings(((await this.loadData()) ?? {}) as Record<string, unknown>);
	}

	saveSettings(): Promise<void> {
		return this.saveQueue.run(async () => {
			const existing = ((await this.loadData()) ?? {}) as Record<string, unknown>;
			await this.saveData({ ...existing, ...this.settings });
			this.recipeStores.hideCheckedItems.set(this.settings.hideCheckedItems);
		});
	}
}
