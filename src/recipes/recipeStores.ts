import { writable, derived } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type { Recipe } from "./repository";
import type { PersistedShoppingList } from "../types";
import type { CookbookSettings } from "../settings";

export interface RecipeStores {
	recipes: Writable<Recipe[]>;
	selectedRecipes: Readable<Recipe[]>;
	cookTogetherRecipes: Readable<Recipe[]>;
	shoppingList: Writable<PersistedShoppingList | null>;
	/** A copy of the settings, replaced on every save so views stay current. */
	settings: Writable<CookbookSettings>;
}

export function createRecipeStores(settings: CookbookSettings): RecipeStores {
	const recipes = writable<Recipe[]>([]);

	const selectedRecipes = derived(recipes, ($r) =>
		$r.filter((r) => r.cook_soon),
	);

	const cookTogetherRecipes = derived(recipes, ($r) => $r.filter((r) => r.cook_together));

	const shoppingList = writable<PersistedShoppingList | null>(null);

	return {
		recipes,
		selectedRecipes,
		cookTogetherRecipes,
		shoppingList,
		settings: writable({ ...settings }),
	};
}
