export interface ShoppingItem {
	id: string;
	text: string;
	quantity: number | null;
	checked: boolean;
	category: string;
	source: "recipe" | "custom";
	recipeTitle?: string;
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
