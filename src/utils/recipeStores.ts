import { writable, derived } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type { Recipe } from "./recipeUtils";
import type { PersistedShoppingList } from "../types";

export interface RecipeStores {
	recipes: Writable<Recipe[]>;
	selectedRecipes: Readable<Recipe[]>;
	shoppingList: Writable<PersistedShoppingList | null>;
}

export function createRecipeStores(): RecipeStores {
	const recipes = writable<Recipe[]>([]);

	const selectedRecipes = derived(recipes, ($r) =>
		$r.filter((r) => r.cook_soon),
	);

	const shoppingList = writable<PersistedShoppingList | null>(null);

	return { recipes, selectedRecipes, shoppingList };
}
