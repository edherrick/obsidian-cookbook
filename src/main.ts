import { Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { get } from "svelte/store";
import { CookbookSettingTab } from "./settings/settingsTab";
import { mergeSettings } from "./settings";
import type { CookbookSettings } from "./settings";
import { SvelteModalWrapper } from "./utils/SvelteModalWrapper";
import { SerialQueue } from "./utils/serialQueue";
import CookbookRibbonModal from "./ui/modals/CookbookRibbonModal.svelte";
import RecipesModal from "./ui/modals/RecipesModal.svelte";
import { VIEW_TYPE_SHOPPING, CookbookShoppingView } from "./ui/views/CookbookShoppingView";
import { applySetCookSoon, getRecipes } from "./recipes/repository";
import type { Recipe } from "./recipes/repository";
import { createRecipeStores } from "./recipes/recipeStores";
import type { RecipeStores } from "./recipes/recipeStores";
import { IngredientCache } from "./ingredients/cache";
import type { ParsedIngredient } from "./ingredients/parse";
import { buildShoppingList } from "./shopping/build";
import { UNCATEGORIZED } from "./ingredients/categorize";
import { ShoppingListPersistence } from "./shopping/persistence";
import type { PersistedShoppingList, StoreLayout } from "./types";
import { Vocabulary } from "./vocab/vocabulary";
import { loadCookSession, prepareCookSession, writeCookSessionNote } from "./session/write";
import type { CookSession } from "./session/write";
import { recipeDots } from "./session/build";
import { toPlan } from "./session/plan";
import type { PlanEntry } from "./session/plan";
import ArrangeStepsModal from "./ui/modals/ArrangeStepsModal.svelte";
import { VocabularyCheckModal } from "./vocab/checkModal";
import { indexIngredientNames } from "./vocab/names";
import type { IngredientName } from "./vocab/names";

/** Frontmatter edits arrive in bursts; rescanning once per burst is enough. */
const RECIPE_REFRESH_DEBOUNCE_MS = 500;

export default class CookbookPlugin extends Plugin {
	settings: CookbookSettings;
	recipeStores: RecipeStores;
	/** Aliases, techniques and staples — rebuilt whenever settings change. */
	vocabulary: Vocabulary;

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
				new CookbookShoppingView(leaf, this.recipeStores, {
					saveShoppingList: (data) => this.saveShoppingList(data),
					getShoppingCategories: () => this.settings.shoppingCategories,
					getStoreLayouts: () => this.settings.storeLayouts,
					getActiveStoreLayout: () => this.settings.activeStoreLayout,
					onReorder: (aisleOrder) => this.saveAisleOrder(aisleOrder),
					onSelectStore: (name) => this.selectStoreLayout(name),
				}),
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

		this.addCommand({
			id: "create-cook-session",
			name: "Start cooking session",
			callback: () => void this.createCookSession(false),
		});

		this.addCommand({
			id: "arrange-cook-order",
			name: "Arrange cook order",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !this.isCookSession(file)) return false;
				if (!checking) void this.arrangeSessionFile(file);
				return true;
			},
		});

		// The "Arrange the cook order" link in each session note
		this.registerObsidianProtocolHandler("cookbook-arrange", (params) => {
			const file = params.file ? this.app.vault.getFileByPath(params.file) : null;
			if (file) void this.arrangeSessionFile(file);
			else new Notice("Could not find that cook session note.");
		});

		this.addCommand({
			id: "check-recipe-vocabulary",
			name: "Check recipe technique tags",
			callback: () =>
				new VocabularyCheckModal(this.app, {
					recipes: () => get(this.recipeStores.recipes),
					vocab: () => this.vocabulary,
				}).open(),
		});

		this.addRibbonIcon("utensils", "Cookbook", () => {
			new SvelteModalWrapper(this.app, CookbookRibbonModal, {
				openRecipeModal: () => this.openRecipesModal(),
				generateShoppingList: () => this.generateShoppingList(),
				createCookSession: (markCookSoon: boolean) => this.createCookSession(markCookSoon),
				refreshRecipes: () => this.refreshRecipes(),
				stores: this.recipeStores,
				app: this.app,
				cookSoonProp: this.settings.cookSoonProp,
				cookTogetherProp: this.settings.cookTogetherProp,
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
				{
					cookTogetherProp: this.settings.cookTogetherProp,
					techniqueTagPrefix: this.settings.techniqueTagPrefix,
				},
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
			cookTogetherProp: this.settings.cookTogetherProp,
			coverProp: this.settings.coverProp,
			ingredientGroups: this.settings.ingredientGroups,
			overlap: {
				vocab: this.vocabulary,
				categories: this.settings.shoppingCategories,
				ignoreCategories: this.settings.overlapIgnoreCategories,
			},
		}).open();
	}

	// ─── Shopping list ───────────────────────────────────────────────────────

	private async generateShoppingList(): Promise<void> {
		// Read back from storage rather than the store: the shopping list view
		// persists reorders and check-offs straight to disk, so the store can be
		// behind, and a stale read here would undo a hand-sorted category order.
		const existing = (await this.shoppingList.load()) ?? get(this.recipeStores.shoppingList);
		const route = this.activeLayout()?.aisleOrder ?? existing?.categoryOrder ?? [];
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
				existingOrder: route,
				vocab: this.vocabulary,
			},
		);

		// Preserve any custom items the user added before/between generations
		const preserved = existing?.items.filter((i) => i.source === "custom") ?? [];
		if (preserved.length > 0) list.items = [...list.items, ...preserved];

		this.recipeStores.shoppingList.set(list);
		await this.saveShoppingList(list);
		await this.openShoppingListView();
	}

	/** Every distinct ingredient in the recipe library, for the aliases panel. */
	async ingredientNames(): Promise<IngredientName[]> {
		await this.refreshRecipes();
		const recipes = get(this.recipeStores.recipes);
		const byRecipe = await Promise.all(
			recipes.map(
				async (r): Promise<[string, ParsedIngredient[]]> => [
					r.title,
					await this.ingredientCache.get(this.app, r),
				],
			),
		);
		return indexIngredientNames(byRecipe, this.vocabulary);
	}

	// ─── Cook sessions ───────────────────────────────────────────────────────

	/**
	 * Write today's session note for the cook-together recipes and open it.
	 * Optionally marks them cook-soon too, so the shopping list follows.
	 */
	async createCookSession(markCookSoon: boolean): Promise<void> {
		await this.refreshRecipes();
		const recipes = get(this.recipeStores.cookTogetherRecipes);
		if (recipes.length === 0) {
			new Notice("No recipes are marked cook together.");
			return;
		}
		if (markCookSoon) {
			applySetCookSoon(
				this.recipeStores.recipes,
				recipes.map((r) => r.path),
				this.app,
				this.settings.cookSoonProp,
			);
		}
		try {
			const session = await prepareCookSession(this.app, recipes, {
				folder: this.settings.cookSessionFolder,
				cache: this.ingredientCache,
			});
			const file = await this.saveCookSession(session, toPlan(session.steps));
			await this.app.workspace.getLeaf("tab").openFile(file);
			this.openArrangeModal(session);
		} catch (e) {
			console.error("cookbook: failed to write cook session", e);
			new Notice("Could not write the cook session note. See the console for details.");
		}
	}

	private saveCookSession(session: CookSession, plan: PlanEntry[]): Promise<TFile> {
		return writeCookSessionNote(this.app, session, plan, {
			vocab: this.vocabulary,
			unitPrefs: {
				preferredVolumeUnit: this.settings.preferredVolumeUnit,
				preferredWeightUnit: this.settings.preferredWeightUnit,
			},
		});
	}

	private isCookSession(file: TFile): boolean {
		const tags: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.tags;
		const list = Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [];
		return list.some((t) => String(t).replace(/^#/, "") === "cook-session");
	}

	private openArrangeModal(session: CookSession): void {
		new SvelteModalWrapper(this.app, ArrangeStepsModal, {
			session,
			dots: recipeDots(session.recipes),
			save: async (plan: PlanEntry[]) => {
				try {
					await this.saveCookSession(session, plan);
				} catch (e) {
					console.error("cookbook: failed to save cook order", e);
					new Notice("Could not save the cook order. See the console for details.");
					throw e;
				}
			},
		}).open();
	}

	/** Reopen a session note's recipes and cook order for arranging. */
	async arrangeSessionFile(file: TFile): Promise<void> {
		await this.refreshRecipes();
		const recipes = get(this.recipeStores.recipes);
		const session = await loadCookSession(this.app, file, {
			cache: this.ingredientCache,
			findRecipe: (path) => recipes.find((r) => r.path === path),
		});
		if (!session) {
			new Notice("This cook session doesn't link any recipes that still exist.");
			return;
		}
		this.openArrangeModal(session);
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

	// ─── Store layouts ───────────────────────────────────────────────────────

	private activeLayout(): StoreLayout | undefined {
		const { storeLayouts, activeStoreLayout } = this.settings;
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
		await this.saveSettings();
	}

	private async selectStoreLayout(name: string): Promise<void> {
		this.settings.activeStoreLayout = name;
		await this.saveSettings();
	}

	// ─── Settings ────────────────────────────────────────────────────────────

	async loadSettings(): Promise<void> {
		this.settings = mergeSettings(((await this.loadData()) ?? {}) as Record<string, unknown>);
		this.vocabulary = new Vocabulary(this.settings);
	}

	saveSettings(): Promise<void> {
		return this.saveQueue.run(async () => {
			const existing = ((await this.loadData()) ?? {}) as Record<string, unknown>;
			await this.saveData({ ...existing, ...this.settings });
			this.recipeStores.hideCheckedItems.set(this.settings.hideCheckedItems);
			this.vocabulary = new Vocabulary(this.settings);
		});
	}
}
