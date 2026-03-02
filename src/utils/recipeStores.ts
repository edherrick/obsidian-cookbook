import { writable, derived } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type { App } from "obsidian";
import { flushCookSoon, type Recipe } from "./recipeUtils";

export interface RecipeStores {
	recipes: Writable<Recipe[]>;
	selectedRecipes: Readable<Recipe[]>;
}

export function createRecipeStores(app: App): RecipeStores {
	const recipes = writable<Recipe[]>([]);

	const selectedRecipes = derived(recipes, ($r) =>
		$r.filter((r) => r.cook_soon),
	);

	// whenever the list changes, persist all cook-soon flags
	recipes.subscribe((list) => {
		// fire-and-forget; we don't care about the result here
		void Promise.all(list.map((r) => flushCookSoon(r as Recipe, app)));
	});

	return { recipes, selectedRecipes };
}
