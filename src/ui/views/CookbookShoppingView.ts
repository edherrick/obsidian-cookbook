import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import ShoppingListView from "./ShoppingListView.svelte";
import type { RecipeStores } from "../../recipes/recipeStores";
import type { PersistedShoppingList, ShoppingCategory, StoreLayout } from "../../types";

export const VIEW_TYPE_SHOPPING = "cookbook-shopping";

/** Everything the shopping list view needs from the plugin. */
export interface ShoppingViewDeps {
	saveShoppingList: (data: PersistedShoppingList) => Promise<void>;
	getShoppingCategories: () => ShoppingCategory[];
	getStoreLayouts: () => StoreLayout[];
	getActiveStoreLayout: () => string | undefined;
	/** Persist a reordered route into the active store layout. */
	onReorder: (aisleOrder: string[]) => Promise<void>;
	onSelectStore: (name: string) => Promise<void>;
}

export class CookbookShoppingView extends ItemView {
	private component: Record<string, unknown> | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly stores: RecipeStores,
		private readonly deps: ShoppingViewDeps,
	) {
		super(leaf);
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
			props: { stores: this.stores, ...this.deps },
		}) as Record<string, unknown>;
	}

	async onClose(): Promise<void> {
		if (this.component) {
			await unmount(this.component);
			this.component = null;
		}
	}
}
