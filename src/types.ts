export interface ShoppingItem {
	id: string;
	text: string;
	quantity: number | null;
	unit: string | null;
	checked: boolean;
	category: string;
	source: "recipe" | "custom";
	recipeTitle?: string;
	prep?: string;
}

export interface PersistedShoppingList {
	items: ShoppingItem[];
	categoryOrder: string[];
	generatedAt: number;
}

/**
 * A named list of keywords matched against ingredient text.
 *
 * Two different things in this plugin share that shape. They are kept as
 * separate names because they answer different questions and may yet diverge.
 */
export interface KeywordGroup {
	name: string;
	keywords: string[];
}

/** A shopping-list aisle. Every item lands in exactly one, chosen in list order. */
export type ShoppingCategory = KeywordGroup;

/** A dietary group for filtering recipes. A recipe may match several at once. */
export type IngredientGroup = KeywordGroup;
