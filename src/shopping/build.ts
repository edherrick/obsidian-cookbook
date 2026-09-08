import type { App } from "obsidian";
import type { PersistedShoppingList, ShoppingCategory } from "../types";
import type { Recipe } from "../recipes/repository";
import type { IngredientCache } from "../ingredients/cache";
import { assignCategory, UNCATEGORIZED } from "../ingredients/categorize";
import { aggregateItems } from "../ingredients/aggregate";
import type { DisplayUnitPrefs } from "../ingredients/aggregate";
import { roundQty } from "../ingredients/units";
import { parseChecklistItems } from "../ingredients/parse";
import type { ParsedIngredient } from "../ingredients/parse";

export interface BuildShoppingListOptions {
	cache?: IngredientCache;
	unitPrefs?: DisplayUnitPrefs;
	/** The order the user has already arranged categories into, if any. */
	existingOrder?: string[];
}

/**
 * Category order is the user's, not the settings'. Their arrangement is kept
 * as-is and any category they haven't seen yet is appended, so regenerating a
 * list no longer throws away a hand-sorted aisle order.
 */
function mergeCategoryOrder(existing: string[], categories: ShoppingCategory[]): string[] {
	const order = existing.filter((c) => c !== UNCATEGORIZED);
	for (const c of categories) {
		if (c.name && !order.includes(c.name)) order.push(c.name);
	}
	order.push(UNCATEGORIZED);
	return order;
}

async function readIngredients(
	app: App,
	recipe: Recipe,
	cache?: IngredientCache,
): Promise<ParsedIngredient[]> {
	if (cache) return cache.get(app, recipe);
	const file = app.vault.getFileByPath(recipe.path);
	if (!file) return [];
	return parseChecklistItems(await app.vault.read(file));
}

export async function buildShoppingList(
	app: App,
	recipes: Recipe[],
	categories: ShoppingCategory[],
	options: BuildShoppingListOptions = {},
): Promise<PersistedShoppingList> {
	const cookSoonRecipes = recipes.filter((r) => r.cook_soon);

	// Read all recipe files in parallel, reusing the per-file ingredient cache
	const perRecipeItems = await Promise.all(
		cookSoonRecipes.map(async (recipe) => {
			try {
				const multiplier = recipe.cook_multiplier ?? 1;
				return (await readIngredients(app, recipe, options.cache)).map((parsed) => ({
					id: "",
					text: parsed.text,
					quantity: parsed.quantity !== null ? roundQty(parsed.quantity * multiplier) : null,
					unit: parsed.unit,
					checked: false,
					category: assignCategory(parsed.text, categories),
					source: "recipe" as const,
					recipeTitle: recipe.title,
					prep: parsed.prep,
				}));
			} catch (e) {
				console.error("buildShoppingList: failed reading", recipe.path, e);
				return [];
			}
		}),
	);

	// Flatten and assign stable ids
	const items = perRecipeItems.flat().map((item, i) => ({ ...item, id: String(i) }));

	return {
		items: aggregateItems(items, options.unitPrefs),
		categoryOrder: mergeCategoryOrder(options.existingOrder ?? [], categories),
		generatedAt: Date.now(),
	};
}
