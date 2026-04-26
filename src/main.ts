import { Plugin, WorkspaceLeaf, normalizePath, TFile } from "obsidian";
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
import { getRecipes, buildShoppingList, clearIngredientCache, formatQty } from "./utils/recipeUtils";
import { createRecipeStores } from "./utils/recipeStores";
import type { RecipeStores } from "./utils/recipeStores";
import type { PersistedShoppingList, ShoppingCategory, IngredientGroup, ShoppingItem } from "./types";

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
				// Preserve any custom items the user added before/between generations
				const existing = get(stores.shoppingList);
				if (existing) {
					const preserved = existing.items.filter((i) => i.source === "custom");
					if (preserved.length > 0) list.items = [...list.items, ...preserved];
				}
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

		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!(file instanceof TFile)) return;
				if (!this.settings.shoppingListFilePath?.trim()) return;
				if (file.path !== this.resolveShoppingListPath()) return;
				const content = await this.app.vault.read(file);
				if (content === this._lastWrittenContent) return;
				const parsed = this.parseShoppingListFromMarkdown(content);
				if (parsed) this.recipeStores.shoppingList.set(parsed);
			}),
		);

		this.addSettingTab(new CookbookSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_SHOPPING);
	}

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
			shoppingListFilePath:
				(data.shoppingListFilePath as string | undefined) ??
				DEFAULT_SETTINGS.shoppingListFilePath,
		};
	}

	private async ensureDirectoryExists(dir: string): Promise<void> {
		if (!dir || dir === ".") return;
		if (await this.app.vault.adapter.exists(dir)) return;
		const parent = dir.split("/").slice(0, -1).join("/");
		if (parent) await this.ensureDirectoryExists(parent);
		await this.app.vault.adapter.mkdir(dir);
	}

	private static getItemsInDisplayOrder(data: PersistedShoppingList): ShoppingItem[] {
		const byCategory = new Map<string, ShoppingItem[]>();
		for (const item of data.items) {
			const cat = item.category || "Uncategorized";
			if (!byCategory.has(cat)) byCategory.set(cat, []);
			byCategory.get(cat)!.push(item);
		}
		const orderedCats = [
			...data.categoryOrder.filter((c) => byCategory.has(c)),
			...[...byCategory.keys()].filter((c) => !data.categoryOrder.includes(c)),
		];
		const result: ShoppingItem[] = [];
		for (const cat of orderedCats) result.push(...byCategory.get(cat)!);
		return result;
	}

	private serializeShoppingList(data: PersistedShoppingList): string {
		const lines: string[] = ["# Shopping List"];
		if (data.generatedAt) {
			lines.push(`_Generated: ${new Date(data.generatedAt).toLocaleString()}_`);
		}

		const ordered = CookbookPlugin.getItemsInDisplayOrder(data);
		let currentCat = "";
		for (const item of ordered) {
			const cat = item.category || "Uncategorized";
			if (cat !== currentCat) {
				lines.push("", `## ${cat}`);
				currentCat = cat;
			}
			const check = item.checked ? "x" : " ";
			const qty = item.quantity !== null ? `${formatQty(item.quantity)} ` : "";
			const unit = item.unit ? `${item.unit} ` : "";
			const prep = item.prep ? `, ${item.prep}` : "";
			lines.push(`- [${check}] ${qty}${unit}${item.text}${prep}`);
		}

		lines.push("", "%%", JSON.stringify(data), "%%");
		return lines.join("\n");
	}

	private parseShoppingListFromMarkdown(content: string): PersistedShoppingList | null {
		const start = content.lastIndexOf("\n%%\n");
		if (start === -1) return null;
		const jsonStart = start + 4;
		const end = content.indexOf("\n%%", jsonStart);
		if (end === -1) return null;

		let data: PersistedShoppingList;
		try {
			data = JSON.parse(content.slice(jsonStart, end)) as PersistedShoppingList;
		} catch {
			return null;
		}

		// Overlay checked state from the markdown body — the user edits checkboxes
		// in the rendered note, not the %% JSON block, so we reconcile here.
		const body = content.slice(0, start);
		const checkboxStates = body.split("\n")
			.filter((line) => /^- \[[ x]\] /.test(line))
			.map((line) => line[3] === "x");
		const orderedItems = CookbookPlugin.getItemsInDisplayOrder(data);
		if (checkboxStates.length === orderedItems.length) {
			orderedItems.forEach((item, i) => { item.checked = checkboxStates[i]!; });
		}

		return data;
	}

	private resolveShoppingListPath(): string {
		const p = normalizePath(this.settings.shoppingListFilePath!.trim());
		const filename = p.split("/").pop() ?? p;
		return filename.includes(".") ? p : `${p}.md`;
	}

	private _lastWrittenContent = "";

	private async saveShoppingListToFile(data: PersistedShoppingList): Promise<void> {
		try {
			const path = this.resolveShoppingListPath();
			const content = this.serializeShoppingList(data);
			const parts = path.split("/");
			if (parts.length > 1) {
				await this.ensureDirectoryExists(parts.slice(0, -1).join("/"));
			}
			// Set before the write so the modify event handler recognises this as ours
			this._lastWrittenContent = content;
			const file = this.app.vault.getFileByPath(path);
			if (file) {
				await this.app.vault.modify(file, content);
			} else {
				await this.app.vault.create(path, content);
			}
		} catch (e) {
			console.error("cookbook: failed to save shopping list to vault file", e);
		}
	}

	private async loadShoppingListFromFile(): Promise<PersistedShoppingList | null> {
		const path = this.resolveShoppingListPath();
		const file = this.app.vault.getFileByPath(path);
		if (!file) return null;
		const content = await this.app.vault.read(file);
		return this.parseShoppingListFromMarkdown(content);
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
			if (this.settings.shoppingListFilePath?.trim()) {
				await this.saveShoppingListToFile(data);
			} else {
				const existing =
					((await this.loadData()) ?? {}) as Record<string, unknown>;
				await this.saveData({ ...existing, shoppingList: data });
			}
		});
	}

	async loadShoppingList(): Promise<PersistedShoppingList | null> {
		if (this.settings.shoppingListFilePath?.trim()) {
			return this.loadShoppingListFromFile();
		}
		const data =
			((await this.loadData()) ?? {}) as Record<string, unknown>;
		return (data.shoppingList as PersistedShoppingList) ?? null;
	}
}
