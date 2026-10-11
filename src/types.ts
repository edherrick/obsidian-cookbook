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
export interface IngredientGroup extends KeywordGroup {
	/**
	 * Terms that look like a match but are not one.
	 *
	 * Categories arbitrate by keyword specificity because they compete for an
	 * item; groups do not compete, so nothing can outrank a short keyword. This
	 * is how "coconut milk" stops counting as Dairy and "rice noodles" stops
	 * counting as Gluten.
	 */
	excludeKeywords?: string[];
}

/**
 * A route through one shop: the order its aisles are walked in.
 *
 * Only the ordering varies between shops — what an ingredient *is* does not —
 * so a layout references categories by name rather than redefining them.
 */
export interface StoreLayout {
	name: string;
	aisleOrder: string[];
}

/**
 * A prep technique. Recipes name one with the tag `#<prefix>/<name>`; its
 * keywords are the untagged words that count as it ("cubed" is dice). The
 * order of the list is the order prep is done in — peel before you dice.
 */
export type Technique = KeywordGroup;

/** One canonical ingredient name, and the other names that mean the same thing. */
export type IngredientAlias = KeywordGroup;
