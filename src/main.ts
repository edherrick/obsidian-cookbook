import { Plugin, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";
import { DEFAULT_SETTINGS, CookbookSettingTab } from "./settings";
import type { CookbookSettings } from "./settings";
import { SvelteModalWrapper } from "./utils/SvelteModalWrapper";
import CookbookRibbonModal from "./ui/modals/CookbookRibbonModal.svelte";
import {
	VIEW_TYPE_SHOPPING,
	CookbookShoppingView,
} from "./ui/views/CookbookShoppingView";
import RecipesModal from "./ui/modals/RecipesModal.svelte";
import { getRecipes, buildShoppingList, clearIngredientCache } from "./utils/recipeUtils";
import { createRecipeStores } from "./utils/recipeStores";
import type { RecipeStores } from "./utils/recipeStores";
import type { PersistedShoppingList, ShoppingCategory, IngredientGroup } from "./types";

export default class CookbookPlugin extends Plugin {
	settings: CookbookSettings;
	recipeStores: RecipeStores;

	async onload() {
		await this.loadSettings();

		this.recipeStores = createRecipeStores(this.settings.hideCheckedItems);

		try {
			const initial = await getRecipes(this.app, this.settings.cookSoonProp, this.settings.ignorePaths, this.settings.recipesFolder, this.settings.recipesTag);
			this.recipeStores.recipes.set(initial);
		} catch (e) {
			console.warn("Failed to populate recipes on load", e);
		}

		try {
			const persisted = await this.loadShoppingList();
			if (persisted) {
				this.recipeStores.shoppingList.set(persisted);
			}
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
			callback: () => this.openShoppingListView(),
		});

		this.addCommand({
			id: "browse",
			name: "Browse recipes",
			callback: () => {
				new SvelteModalWrapper(this.app, RecipesModal, {
					app: this.app,
					stores: this.recipeStores,
					propsToShow: this.settings.propsToShow,
					cookSoonProp: this.settings.cookSoonProp,
					coverProp: this.settings.coverProp,
					ingredientGroups: this.settings.ingredientGroups,
				}).open();
			},
		});

		this.addRibbonIcon("utensils", "Cookbook", () => {
			const stores = this.recipeStores;

			const openRecipeModal = () => {
				new SvelteModalWrapper(this.app, RecipesModal, {
					app: this.app,
					stores,
					propsToShow: this.settings.propsToShow,
					cookSoonProp: this.settings.cookSoonProp,
					ingredientGroups: this.settings.ingredientGroups,
				}).open();
			};

			const generateShoppingList = async () => {
				const recipes = get(stores.recipes);
				const list = await buildShoppingList(
					this.app,
					recipes,
					this.settings.shoppingCategories,
					{
						preferredVolumeUnit: this.settings.preferredVolumeUnit,
						preferredWeightUnit: this.settings.preferredWeightUnit,
					},
				);
				stores.shoppingList.set(list);
				await this.saveShoppingList(list);
				await this.openShoppingListView();
			};

			new SvelteModalWrapper(this.app, CookbookRibbonModal, {
				openRecipeModal,
				generateShoppingList,
				stores,
				app: this.app,
				cookSoonProp: this.settings.cookSoonProp,
				ignorePaths: this.settings.ignorePaths,
				recipesFolder: this.settings.recipesFolder,
				recipesTag: this.settings.recipesTag,
			}).open();
		});

		this.registerEvent(
			this.app.vault.on("modify", (file) => clearIngredientCache(file.path)),
		);

		this.addSettingTab(new CookbookSettingTab(this.app, this));
	}

	onunload() {}

	async openShoppingListView(): Promise<void> {
		const existing =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_SHOPPING);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_SHOPPING, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const data =
			((await this.loadData()) ?? {}) as Record<string, unknown>;
		this.settings = {
			propsToShow:
				(data.propsToShow as string[] | undefined) ??
				DEFAULT_SETTINGS.propsToShow,
			recipesFolder:
				(data.recipesFolder as string | undefined) ??
				DEFAULT_SETTINGS.recipesFolder,
			recipesTag:
				(data.recipesTag as string | undefined) ??
				DEFAULT_SETTINGS.recipesTag,
			cookSoonProp:
				(data.cookSoonProp as string | undefined) ??
				DEFAULT_SETTINGS.cookSoonProp,
			coverProp:
				(data.coverProp as string | undefined) ??
				DEFAULT_SETTINGS.coverProp,
			ignorePaths:
				(data.ignorePaths as string[] | undefined) ??
				DEFAULT_SETTINGS.ignorePaths,
			shoppingCategories:
				(data.shoppingCategories as
					| ShoppingCategory[]
					| undefined) ??
				DEFAULT_SETTINGS.shoppingCategories,
			hideCheckedItems:
				(data.hideCheckedItems as boolean | undefined) ??
				DEFAULT_SETTINGS.hideCheckedItems,
			ingredientGroups:
				(data.ingredientGroups as IngredientGroup[] | undefined) ??
				DEFAULT_SETTINGS.ingredientGroups,
			preferredVolumeUnit:
				(data.preferredVolumeUnit as string | undefined) ??
				DEFAULT_SETTINGS.preferredVolumeUnit,
			preferredWeightUnit:
				(data.preferredWeightUnit as string | undefined) ??
				DEFAULT_SETTINGS.preferredWeightUnit,
		};
	}

	private _saveQueue: Promise<void> = Promise.resolve();

	private enqueue(fn: () => Promise<void>): Promise<void> {
		const next = this._saveQueue.then(fn);
		this._saveQueue = next.then(() => {}, () => {});
		return next;
	}

	async saveSettings(): Promise<void> {
		return this.enqueue(async () => {
			const existing =
				((await this.loadData()) ?? {}) as Record<string, unknown>;
			await this.saveData({ ...existing, ...this.settings });
			this.recipeStores.hideCheckedItems.set(this.settings.hideCheckedItems);
		});
	}

	async saveShoppingList(data: PersistedShoppingList): Promise<void> {
		return this.enqueue(async () => {
			const existing =
				((await this.loadData()) ?? {}) as Record<string, unknown>;
			await this.saveData({ ...existing, shoppingList: data });
		});
	}

	async loadShoppingList(): Promise<PersistedShoppingList | null> {
		const data =
			((await this.loadData()) ?? {}) as Record<string, unknown>;
		return (data.shoppingList as PersistedShoppingList) ?? null;
	}
}
