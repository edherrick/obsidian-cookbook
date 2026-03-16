import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import ShoppingListView from "./ShoppingListView.svelte";
import type { RecipeStores } from "../../utils/recipeStores";
import type { PersistedShoppingList } from "../../types";

export const VIEW_TYPE_SHOPPING = "cookbook-shopping";

export class CookbookShoppingView extends ItemView {
	private component: Record<string, unknown> | null = null;
	private readonly stores: RecipeStores;
	private readonly persistShoppingList: (
		data: PersistedShoppingList,
	) => Promise<void>;

	constructor(
		leaf: WorkspaceLeaf,
		stores: RecipeStores,
		persistShoppingList: (data: PersistedShoppingList) => Promise<void>,
	) {
		super(leaf);
		this.stores = stores;
		this.persistShoppingList = persistShoppingList;
	}

	getViewType(): string {
		return VIEW_TYPE_SHOPPING;
	}

	getDisplayText(): string {
		return "Shopping List";
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
			},
		}) as Record<string, unknown>;
	}

	async onClose(): Promise<void> {
		if (this.component) {
			unmount(this.component);
			this.component = null;
		}
	}
}
