import { Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import type { Debouncer } from "obsidian";
import { get } from "svelte/store";
import { CookbookSettingTab } from "./settings/settingsTab";
import { convertedData, mergeSettings, toSavedData } from "./settings";
import { needsIngredientMigration } from "./settings/migrate";
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
import type { ParsedIngredient } from "./ingredients/parse";
import type { DisplayUnitPrefs } from "./ingredients/aggregate";
import { ShoppingListController } from "./shopping/controller";
import { CookSessionController } from "./session/controller";
import { Vocabulary } from "./vocab/vocabulary";
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

	readonly ingredientCache = new IngredientCache();
	/** Settings and shopping list saves share one queue so writes can't interleave. */
	readonly saveQueue = new SerialQueue();

	private shopping: ShoppingListController;
	private sessions: CookSessionController;
	private refreshRecipesDebounced: Debouncer<[], void>;

	async onload() {
		await this.loadSettings();

		this.recipeStores = createRecipeStores(this.settings);
		this.shopping = new ShoppingListController(this);
		this.sessions = new CookSessionController(this);
		this.refreshRecipesDebounced = debounce(
			() => void this.refreshRecipes(),
			RECIPE_REFRESH_DEBOUNCE_MS,
			false,
		);

		// The vault index and metadata cache may still be warming up during
		// onload, so the shopping list note might not be findable yet.
		this.app.workspace.onLayoutReady(() => {
			void this.refreshRecipes();
			void this.shopping.loadIfMissing();
			// Registered here so the startup burst of create events is skipped;
			// this catches the note arriving later, e.g. via sync.
			this.registerEvent(
				this.app.vault.on("create", (file) => {
					if (file instanceof TFile) void this.shopping.syncFromFile(file);
				}),
			);
		});

		this.registerView(
			VIEW_TYPE_SHOPPING,
			(leaf: WorkspaceLeaf) =>
				new CookbookShoppingView(leaf, this.recipeStores, this.shopping.viewDeps()),
		);

		this.registerCommands();

		this.addRibbonIcon("utensils", "Cookbook", () => {
			new SvelteModalWrapper(this.app, CookbookRibbonModal, {
				openRecipeModal: () => this.openRecipesModal(),
				generateShoppingList: () => this.shopping.generate(),
				createCookSession: (markCookSoon: boolean) => this.sessions.create(markCookSoon),
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
				void this.shopping.syncFromFile(file);
			}),
		);
		this.registerEvent(this.app.vault.on("delete", (file) => this.ingredientCache.invalidate(file.path)));
		this.registerEvent(
			this.app.vault.on("rename", (_file, oldPath) => this.ingredientCache.invalidate(oldPath)),
		);

		// Frontmatter and tag edits change which notes count as recipes
		this.registerEvent(
			this.app.metadataCache.on("changed", () => this.refreshRecipesDebounced()),
		);

		this.addSettingTab(new CookbookSettingTab(this.app, this));
	}

	onunload() {
		this.refreshRecipesDebounced.cancel();
		this.ingredientCache.invalidate();
	}

	private registerCommands(): void {
		this.addCommand({
			id: "open-shopping-view",
			name: "Open shopping list",
			callback: () => void this.shopping.openView(),
		});

		this.addCommand({
			id: "browse",
			name: "Browse recipes",
			callback: () => this.openRecipesModal(),
		});

		this.addCommand({
			id: "create-cook-session",
			name: "Start cooking session",
			callback: () => void this.sessions.create(false),
		});

		this.addCommand({
			id: "arrange-cook-order",
			name: "Arrange cook order",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !this.sessions.isCookSession(file)) return false;
				if (!checking) void this.sessions.arrange(file);
				return true;
			},
		});

		// The "Arrange the cook order" link in each session note
		this.registerObsidianProtocolHandler("cookbook-arrange", (params) => {
			const file = params.file ? this.app.vault.getFileByPath(params.file) : null;
			if (file) void this.sessions.arrange(file);
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
				ignoreCategories: this.settings.overlapIgnoreCategories,
			},
		}).open();
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

	unitPrefs(): DisplayUnitPrefs {
		return {
			preferredVolumeUnit: this.settings.preferredVolumeUnit,
			preferredWeightUnit: this.settings.preferredWeightUnit,
		};
	}

	// ─── Settings ────────────────────────────────────────────────────────────

	async loadSettings(): Promise<void> {
		const raw = await this.readData();
		this.settings = mergeSettings(raw);
		this.vocabulary = new Vocabulary(this.settings);
		// Settings from before the ingredient list were converted on load: save
		// the result once, keeping the old lists alongside
		if (needsIngredientMigration(raw)) {
			await this.saveQueue.run(() => this.saveData(convertedData(raw, this.settings)));
		}
	}

	saveSettings(): Promise<void> {
		return this.saveQueue.run(async () => {
			const existing = await this.readData();
			await this.saveData({ ...existing, ...toSavedData(this.settings) });
			this.vocabulary = new Vocabulary(this.settings);
			// A fresh object so every subscriber sees the change
			this.recipeStores.settings.set({ ...this.settings });
		});
	}

	/** Carry a category rename (or deletion, with `to` null) into the current shopping list. */
	renameShoppingListCategory(from: string, to: string | null): Promise<void> {
		return this.shopping.renameCategory(from, to);
	}

	/** Re-sort the open shopping list by the active store's aisle order. */
	applyActiveRoute(): Promise<void> {
		return this.shopping.applyActiveRoute();
	}

	/** Plugin data.json, or an empty object on first run. */
	async readData(): Promise<Record<string, unknown>> {
		return ((await this.loadData()) ?? {}) as Record<string, unknown>;
	}
}
