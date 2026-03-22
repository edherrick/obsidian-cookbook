import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { PersistedShoppingList, ShoppingCategory, ShoppingItem } from "../types";

export interface Recipe {
	path: string;
	cook_soon: boolean;
	cook_multiplier: number;
	title: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[frontMatterProp: string]: any;
	__tags: string[];
}

export async function getRecipes(app: App): Promise<Recipe[]> {
	const files = app.vault.getFiles();
	const recipes: Recipe[] = [];

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const fm = cache.frontmatter;

		const inlineTags = cache.tags?.map((t) => t.tag) ?? [];
		const fmTags =
			typeof fm.tags === "string"
				? [fm.tags]
				: Array.isArray(fm.tags)
					? fm.tags
					: [];

		const normalizedTags = [
			...inlineTags,
			...fmTags.map((t: string) => (t.startsWith("#") ? t : `#${t}`)),
		];

		if (!normalizedTags.includes("#recipe")) continue;

		recipes.push({
			...fm,
			path: file.path,
			cook_soon: !!fm["cook-soon"],
			cook_multiplier: 1,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			title: fm.title ?? file.basename,
			__tags: normalizedTags,
		});
	}

	return recipes;
}

export async function flushCookSoon(recipe: Recipe, app: App) {
	if (!recipe.path) return;
	const file = app.vault.getAbstractFileByPath(recipe.path);
	if (!(file instanceof TFile)) return;
	await app.fileManager.processFrontMatter(file, (fm) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		fm["cook-soon"] = !!recipe.cook_soon;
	});
}

export function toggleCookSoon(recipe: Recipe) {
	recipe.cook_soon = !recipe.cook_soon;
}

export function assignCategory(text: string, categories: ShoppingCategory[]): string {
	const lower = text.toLowerCase();
	for (const cat of categories) {
		for (const kw of cat.keywords) {
			if (lower.includes(kw.toLowerCase())) {
				return cat.name;
			}
		}
	}
	return "Uncategorized";
}

export async function buildShoppingList(
	app: App,
	recipes: Recipe[],
	categories: ShoppingCategory[],
): Promise<PersistedShoppingList> {
	const items: ShoppingItem[] = [];
	const checkboxRe = /^[-*]\s*\[[ xX]?\]\s*(.+)$/gm;
	let idCounter = 0;

	for (const recipe of recipes) {
		if (!recipe.cook_soon) continue;
		const file = app.vault.getAbstractFileByPath(recipe.path);
		if (!(file instanceof TFile)) continue;

		try {
			const text = await app.vault.read(file);
			checkboxRe.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = checkboxRe.exec(text)) !== null) {
				const raw = m[1]!.trim();
				const qtyMatch = /^([0-9]+(?:\.[0-9]+)?)\s+(.+)$/.exec(raw);
				const quantity = qtyMatch ? parseFloat(qtyMatch[1]!) * (recipe.cook_multiplier ?? 1) : null;
				const itemText = qtyMatch ? qtyMatch[2]!.trim() : raw;

				items.push({
					id: String(idCounter++),
					text: itemText,
					quantity,
					checked: false,
					category: assignCategory(itemText, categories),
					source: "recipe",
					recipeTitle: recipe.title,
				});
			}
		} catch (e) {
			console.error("buildShoppingList: failed reading", recipe.path, e);
		}
	}

	const categoryOrder = [
		...categories.map((c) => c.name),
		"Uncategorized",
	];

	return { items: aggregateItems(items), categoryOrder, generatedAt: Date.now() };
}

/**
 * Aggregate shopping items by normalised text (case-insensitive).
 * Items with the same text are merged: quantities are summed and recipe
 * source titles are joined into a comma-separated string.
 */
function aggregateItems(items: ShoppingItem[]): ShoppingItem[] {
	const map = new Map<string, ShoppingItem>();
	for (const item of items) {
		// Normalise: lowercase, collapse whitespace, strip control chars
		const key = item.text.toLowerCase().replace(/\s+/g, " ").trim();
		const existing = map.get(key);
		if (existing) {
			if (existing.quantity !== null && item.quantity !== null) {
				existing.quantity = existing.quantity + item.quantity;
			} else if (item.quantity !== null) {
				existing.quantity = item.quantity;
			}
			if (
				item.recipeTitle &&
				item.recipeTitle !== existing.recipeTitle
			) {
				existing.recipeTitle = existing.recipeTitle
					? `${existing.recipeTitle}, ${item.recipeTitle}`
					: item.recipeTitle;
			}
		} else {
			map.set(key, { ...item });
		}
	}
	return Array.from(map.values());
}
