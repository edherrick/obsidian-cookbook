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

/** A name and the words that count as it. Used by prep techniques. */
export interface KeywordGroup {
	name: string;
	keywords: string[];
}

/**
 * A kind of ingredient (Produce, Dairy & Eggs…). Every ingredient has one;
 * the shopping list groups items by it.
 */
export interface ShoppingCategory {
	name: string;
}

/** A dietary group for filtering recipes (Dairy, Gluten…). An ingredient may be in several. */
export interface IngredientGroup {
	name: string;
}

/**
 * One ingredient the cookbook knows, and everything said about it. This is
 * the one place an ingredient is described; categories and dietary groups
 * only hold names.
 */
export interface Ingredient {
	/** Shown on the shopping list. Also matched as a word in recipe lines. */
	name: string;
	/** Other words for the same ingredient. Lines using them merge with it. */
	otherNames: string[];
	/** A shopping category name; "" is Uncategorized. */
	category: string;
	/** Dietary group names. */
	groups: string[];
	/** Used by nearly every recipe, so it says nothing about overlap. */
	staple?: boolean;
}

/**
 * Settings before the ingredient list (1.5 and earlier): every list held its
 * own keywords. Read only to convert old settings.
 */
export interface LegacyKeywordLists {
	shoppingCategories: KeywordGroup[];
	ingredientGroups: (KeywordGroup & { excludeKeywords?: string[] })[];
	ingredientAliases: KeywordGroup[];
	stapleIngredients: string[];
}

/**
 * A route through one shop: the order its aisles are walked in.
 *
 * Only the ordering varies between shops — what an ingredient *is* does not —
 * so a layout references categories by name rather than redefining them.
 */
export interface StoreLayout {
	name: string;
	/**
	 * Categories in walking order. Used for categories not in a numbered aisle,
	 * which come after the aisles on the shopping list.
	 */
	aisleOrder: string[];
	/** The shop's numbered aisles and what's in each. Optional: a store may have none. */
	aisles?: Aisle[];
}

/** One numbered aisle in a shop. */
export interface Aisle {
	number: number;
	/** Categories shelved here. */
	categories: string[];
	/** Single ingredients this shop keeps here, whatever their category. */
	ingredients: string[];
}

/**
 * A prep technique. Recipes name one with the tag `#<prefix>/<name>`; its
 * keywords are the untagged words that count as it ("cubed" is dice). The
 * order of the list is the order prep is done in — peel before you dice.
 */
export type Technique = KeywordGroup;
