import type { App } from "obsidian";
import type { Recipe } from "../recipes/repository";
import { parseChecklistItems } from "./parse";
import type { ParsedIngredient } from "./parse";

/**
 * Per-recipe parsed-ingredient cache.
 *
 * Owned by the plugin instance rather than the module, so a plugin reload
 * starts from a clean cache instead of inheriting stale entries.
 */
export class IngredientCache {
	private readonly entries = new Map<string, ParsedIngredient[]>();

	async get(app: App, recipe: Recipe): Promise<ParsedIngredient[]> {
		const cached = this.entries.get(recipe.path);
		if (cached) return cached;

		const file = app.vault.getFileByPath(recipe.path);
		if (!file) return [];

		const results = parseChecklistItems(await app.vault.read(file));
		this.entries.set(recipe.path, results);
		return results;
	}

	invalidate(path?: string): void {
		if (path) this.entries.delete(path);
		else this.entries.clear();
	}
}
