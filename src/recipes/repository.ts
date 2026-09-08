import { normalizePath } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Writable } from "svelte/store";

export interface Recipe {
	path: string;
	cook_soon: boolean;
	cook_multiplier: number;
	title: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[frontMatterProp: string]: any;
	__tags: string[];
}

export function isIgnored(filePath: string, ignorePaths: string[]): boolean {
	for (const p of ignorePaths) {
		const normalized = normalizePath(p.trim());
		if (!normalized) continue;
		// Folder match: ignore path is a prefix (with trailing slash enforced)
		const folderPrefix = normalized.endsWith("/") ? normalized : normalized + "/";
		if (filePath.startsWith(folderPrefix)) return true;
		// Exact file match
		if (filePath === normalized) return true;
	}
	return false;
}

export async function getRecipes(
	app: App,
	cookSoonProp = "cook-soon",
	ignorePaths: string[] = [],
	recipesFolder?: string,
	recipesTag = "#recipe",
): Promise<Recipe[]> {
	// Only markdown files can carry recipe frontmatter — skip images, PDFs, etc.
	const files: TFile[] = app.vault.getMarkdownFiles();
	const recipes: Recipe[] = [];
	const normalizedFolder =
		recipesFolder && recipesFolder !== "." ? normalizePath(recipesFolder.trim()) : null;
	const expectedTag = recipesTag.startsWith("#") ? recipesTag : `#${recipesTag}`;

	for (const file of files) {
		if (normalizedFolder && !file.path.startsWith(normalizedFolder + "/")) continue;
		if (ignorePaths.length > 0 && isIgnored(file.path, ignorePaths)) continue;

		const cache = app.metadataCache.getFileCache(file);
		// Frontmatter is optional — an inline #recipe tag is enough to qualify
		const fm: Record<string, unknown> = cache?.frontmatter ?? {};

		const inlineTags = cache?.tags?.map((t) => t.tag) ?? [];
		const fmTags =
			typeof fm.tags === "string" ? [fm.tags] : Array.isArray(fm.tags) ? fm.tags : [];

		const normalizedTags = [
			...inlineTags,
			...(fmTags as string[]).map((t) => (t.startsWith("#") ? t : `#${t}`)),
		];

		if (!normalizedTags.includes(expectedTag)) continue;

		recipes.push({
			...fm,
			path: file.path,
			cook_soon: !!fm[cookSoonProp],
			cook_multiplier: 1,
			title: (fm.title as string | undefined) ?? file.basename,
			__tags: normalizedTags,
		});
	}

	return recipes;
}

export async function flushCookSoon(recipe: Recipe, app: App, cookSoonProp = "cook-soon") {
	if (!recipe.path) return;
	const file = app.vault.getFileByPath(recipe.path);
	if (!file) return;
	await app.fileManager.processFrontMatter(file, (fm) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		fm[cookSoonProp] = !!recipe.cook_soon;
	});
}

export function toggleCookSoon(recipe: Recipe) {
	recipe.cook_soon = !recipe.cook_soon;
}

/**
 * Toggle cook-soon in the store and write the change back to frontmatter.
 * The multiplier is deliberately left alone — un-toggling and re-toggling a
 * recipe should not silently discard a ×3.
 */
export function applyToggleCookSoon(
	recipesStore: Writable<Recipe[]>,
	path: string,
	app: App,
	cookSoonProp: string,
): void {
	let toggled: Recipe | undefined;
	recipesStore.update((list) =>
		list.map((r) => {
			if (r.path !== path) return r;
			toggled = { ...r, cook_soon: !r.cook_soon, [cookSoonProp]: !r[cookSoonProp] };
			return toggled;
		}),
	);
	if (toggled) void flushCookSoon(toggled, app, cookSoonProp);
}

export function applySetMultiplier(
	recipesStore: Writable<Recipe[]>,
	path: string,
	multiplier: number,
): void {
	recipesStore.update((list) =>
		list.map((r) => (r.path === path ? { ...r, cook_multiplier: multiplier } : r)),
	);
}
