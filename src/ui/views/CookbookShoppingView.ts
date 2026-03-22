import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import ShoppingListView from "./ShoppingListView.svelte";
import type { RecipeStores } from "../../utils/recipeStores";
import type { PersistedShoppingList, ShoppingCategory } from "../../types";

export const VIEW_TYPE_SHOPPING = "cookbook-shopping";

export class CookbookShoppingView extends ItemView {
	private component: Record<string, unknown> | null = null;
	private readonly stores: RecipeStores;
	private readonly persistShoppingList: (
		data: PersistedShoppingList,
	) => Promise<void>;
	private readonly getShoppingCategories: () => ShoppingCategory[];

	constructor(
		leaf: WorkspaceLeaf,
		stores: RecipeStores,
		persistShoppingList: (data: PersistedShoppingList) => Promise<void>,
		getShoppingCategories: () => ShoppingCategory[],
	) {
		super(leaf);
		this.stores = stores;
		this.persistShoppingList = persistShoppingList;
		this.getShoppingCategories = getShoppingCategories;
	}

	getViewType(): string {
		return VIEW_TYPE_SHOPPING;
	}

	getDisplayText(): string {
		return "Shopping list";
	}

	getIcon(): string {
		return "shopping-cart";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.component = mount(ShoppingListView, {
			target: this.contentEl,
			props: {
				stores: this.stores,
				saveShoppingList: this.persistShoppingList,
				shoppingCategories: this.getShoppingCategories(),
			},
		}) as Record<string, unknown>;
	}

	async onClose(): Promise<void> {
		if (this.component) {
			await unmount(this.component);
			this.component = null;
		}
	}
}
