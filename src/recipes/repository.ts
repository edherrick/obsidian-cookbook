import { normalizePath } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Writable } from "svelte/store";

export interface Recipe {
	path: string;
	cook_soon: boolean;
	cook_together?: boolean;
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

export interface RecipeScanOptions {
	cookTogetherProp?: string;
	/** Technique tags (`#prep/dice`) become a filterable `technique` property. */
	techniqueTagPrefix?: string;
}

export async function getRecipes(
	app: App,
	cookSoonProp = "cook-soon",
	ignorePaths: string[] = [],
	recipesFolder?: string,
	recipesTag = "#recipe",
	options: RecipeScanOptions = {},
): Promise<Recipe[]> {
	const cookTogetherProp = options.cookTogetherProp ?? "cook-together";
	const techniquePrefix = options.techniqueTagPrefix
		? `#${options.techniqueTagPrefix.replace(/^#/, "").replace(/\/+$/, "")}/`.toLowerCase()
		: null;
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

		const techniques = techniquePrefix
			? [
					...new Set(
						inlineTags
							.filter((t) => t.toLowerCase().startsWith(techniquePrefix))
							.map((t) => t.slice(techniquePrefix.length).toLowerCase()),
					),
				].sort()
			: [];

		recipes.push({
			// A frontmatter `technique` property, if a vault has one, wins
			...(techniques.length > 0 ? { technique: techniques } : {}),
			...fm,
			path: file.path,
			cook_soon: !!fm[cookSoonProp],
			cook_together: !!fm[cookTogetherProp],
			cook_multiplier: 1,
			title: (fm.title as string | undefined) ?? file.basename,
			__tags: normalizedTags,
		});
	}

	return recipes;
}

/** Write one boolean recipe flag back to its note's frontmatter. */
async function flushFlag(path: string, value: boolean, app: App, prop: string) {
	if (!path) return;
	const file = app.vault.getFileByPath(path);
	if (!file) return;
	await app.fileManager.processFrontMatter(file, (fm) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		fm[prop] = value;
	});
}

export async function flushCookSoon(recipe: Recipe, app: App, cookSoonProp = "cook-soon") {
	await flushFlag(recipe.path, !!recipe.cook_soon, app, cookSoonProp);
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
	applyToggleFlag(recipesStore, path, app, "cook_soon", cookSoonProp);
}

/** Toggle cook-together in the store and write it back to frontmatter. */
export function applyToggleCookTogether(
	recipesStore: Writable<Recipe[]>,
	path: string,
	app: App,
	cookTogetherProp: string,
): void {
	applyToggleFlag(recipesStore, path, app, "cook_together", cookTogetherProp);
}

/** Set cook-soon on several recipes at once, writing only those that change. */
export function applySetCookSoon(
	recipesStore: Writable<Recipe[]>,
	paths: string[],
	app: App,
	cookSoonProp: string,
): void {
	const wanted = new Set(paths);
	const changed: string[] = [];
	recipesStore.update((list) =>
		list.map((r) => {
			if (!wanted.has(r.path) || r.cook_soon) return r;
			changed.push(r.path);
			return { ...r, cook_soon: true, [cookSoonProp]: true };
		}),
	);
	for (const path of changed) void flushFlag(path, true, app, cookSoonProp);
}

function applyToggleFlag(
	recipesStore: Writable<Recipe[]>,
	path: string,
	app: App,
	field: "cook_soon" | "cook_together",
	prop: string,
): void {
	let next: boolean | undefined;
	recipesStore.update((list) =>
		list.map((r) => {
			if (r.path !== path) return r;
			next = !r[field];
			return { ...r, [field]: next, [prop]: next };
		}),
	);
	if (next !== undefined) void flushFlag(path, next, app, prop);
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
