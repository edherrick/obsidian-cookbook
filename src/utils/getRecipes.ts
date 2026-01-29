import { App } from "obsidian";

export async function getRecipes(app: App): Promise<Record<string, any>[]> {
	const files = app.vault.getFiles();
	const recipes: Record<string, any>[] = [];

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

		recipes.push({
			...fm, // ALL frontmatter properties
			path: file.path, // useful for keys + navigation
			title: fm.title ?? file.basename,
			__tags: normalizedTags,
		});
	}

	return recipes;
}
