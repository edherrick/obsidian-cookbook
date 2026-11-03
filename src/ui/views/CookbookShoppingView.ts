import { ItemView, WorkspaceLeaf } from "obsidian";
import ShoppingListView from "./ShoppingListView.svelte";
import { mountSvelte } from "../../utils/mountSvelte";
import type { RecipeStores } from "../../recipes/recipeStores";
import type { PersistedShoppingList } from "../../types";

export const VIEW_TYPE_SHOPPING = "cookbook-shopping";

/** Everything the shopping list view needs from the plugin besides the stores. */
export interface ShoppingViewDeps {
	saveShoppingList: (data: PersistedShoppingList) => Promise<void>;
	/** Persist a reordered route into the active store layout. */
	onReorder: (aisleOrder: string[]) => Promise<void>;
	onSelectStore: (name: string) => Promise<void>;
	/** Load the saved list if the store has none yet. */
	loadIfMissing: () => Promise<void>;
}

export class CookbookShoppingView extends ItemView {
	private destroy: (() => void) | null = null;

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
		const { loadIfMissing, ...props } = this.deps;
		this.destroy = mountSvelte(ShoppingListView, this.contentEl, { stores: this.stores, ...props });
		// The store can be empty if the note wasn't indexed when the plugin loaded
		void loadIfMissing();
	}

	async onClose(): Promise<void> {
		this.destroy?.();
		this.destroy = null;
	}
}
