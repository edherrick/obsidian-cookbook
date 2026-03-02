import type { App, TFile } from "obsidian";

export interface Recipe {
	path: string;
	cook_soon: boolean;
	title: string;
	[frontMatterProp: string]: any; // allow any other frontmatter properties
	__tags: string[]; // all tags, including inline and frontmatter, normalized to "#tag" format
}

export async function getRecipes(app: App): Promise<Recipe[]> {
	const files = app.vault.getFiles();
	const recipes: Recipe[] = [];

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const fm = cache.frontmatter;

		// Combine inline tags and frontmatter tags
		const inlineTags = cache.tags?.map((t) => t.tag) ?? [];
		const fmTags =
			typeof fm.tags === "string"
				? [fm.tags]
				: Array.isArray(fm.tags)
					? fm.tags
					: [];

		// Normalize tags to "#tag" format
		const normalizedTags = [
			...inlineTags,
			...fmTags.map((t) => (t.startsWith("#") ? t : `#${t}`)),
		];

		// Skip non-recipes
		if (!normalizedTags.includes("#recipe")) continue;

		if (!("cook-soon" in fm)) {
			throw new Error(
				`Recipe ${file.path} is missing "cook-soon" frontmatter property. Please add "cook-soon: false" to the frontmatter of this file.`,
			);
		}

		recipes.push({
			...fm, // ALL frontmatter properties
			path: file.path, // useful for keys + navigation
			cook_soon: !!fm["cook-soon"], // ensure cook_soon is always a boolean
			title: fm.title ?? file.basename,
			__tags: normalizedTags,
		});
	}

	return recipes;
}
/**
 * Flush cook-soon frontmatter for a single recipe
 */
export async function flushCookSoon(recipe: Recipe, app: App) {
	if (!recipe.path) return;
	const file = app.vault.getAbstractFileByPath(recipe.path) as TFile;
	if (!file) return;

	await app.fileManager.processFrontMatter(file, (fm) => {
		// Only write a boolean, default false
		fm["cook-soon"] = !!recipe.cook_soon;
		console.log(
			`Flushed cook-soon for ${recipe.path}: ${fm["cook-soon"]}, recipe value: ${recipe.cook_soon}`,
		);
	});
}

/**
 * Toggle cook-soon for a recipe
 */
export function toggleCookSoon(recipe: Recipe) {
	recipe.cook_soon = !recipe.cook_soon;
}

/**
 * Build a consolidated shopping list from the given recipes.
 *
 * The implementation looks for markdown checkbox lines in each recipe file
 * (`- [ ] …` or `- [x] …`).  It attempts to parse a leading numeric quantity
 * and aggregates amounts for identical items (case‑insensitive).  When no
 * quantity is present the item is counted once per occurrence.
 *
 * @param app     Obsidian app (used to read files)
 * @param recipes array of Recipe objects (usually from the store)
 * @returns a map from item description to total quantity or count
 */
export async function generateShoppingList(app: App, recipes: Recipe[]) {
	const list = new Map<string, number>();

	// regex to capture lines that look like markdown checkboxes
	const checkboxRe = /^[-*]\s*\[[ xX]?\]\s*(.+)$/gm;
	for (const recipe of recipes) {
		if (!recipe.cook_soon) continue;
		const file = app.vault.getAbstractFileByPath(recipe.path);
		if (!file || (file instanceof Object && (file as any).children))
			continue; // skip folders
		try {
			const text = await app.vault.read(file as import("obsidian").TFile);
			let m: RegExpExecArray | null;
			while ((m = checkboxRe.exec(text))) {
				let item = m[1].trim();
				// normalize by lowercasing; keep original for display if desired
				const lower = item.toLowerCase();
				// attempt to parse a leading quantity
				const qtyMatch = /^([0-9]+(?:\.[0-9]+)?)(?:\s+)(.+)$/.exec(
					item,
				);
				if (qtyMatch) {
					const qty = parseFloat(qtyMatch[1]);
					const key = qtyMatch[2].toLowerCase();
					list.set(key, (list.get(key) ?? 0) + qty);
				} else {
					list.set(lower, (list.get(lower) ?? 0) + 1);
				}
			}
		} catch (e) {
			console.error("Failed reading recipe file", recipe.path, e);
		}
	}
	return list;
}
