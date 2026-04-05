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

export interface ShoppingCategory {
	name: string;
	keywords: string[];
}

export type IngredientGroup = { name: string; keywords: string[] };
