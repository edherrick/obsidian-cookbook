import type { App } from "obsidian";
import type { ShoppingItem } from "../types";
import { TFile } from "./obsidian";

export interface FileFixture {
	path: string;
	frontmatter?: Record<string, unknown>;
	inlineTags?: string[];
	content?: string;
}

export function makeApp(files: FileFixture[]): App {
	const tfiles = files.map((f) => new TFile(f.path));
	return {
		vault: {
			getFiles: () => tfiles,
			getMarkdownFiles: () => tfiles.filter((f) => f.path.endsWith(".md")),
			getFileByPath: (path: string) => tfiles.find((f) => f.path === path) ?? null,
			read: async (file: { path: string }) =>
				files.find((f) => f.path === file.path)?.content ?? "",
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const fixture = files.find((f) => f.path === file.path);
				if (!fixture) return null;
				if (!fixture.frontmatter && !fixture.inlineTags) return null;
				return {
					frontmatter: fixture.frontmatter,
					tags: fixture.inlineTags?.map((tag: string) => ({ tag })) ?? [],
				};
			},
		},
		fileManager: {
			processFrontMatter: async (
				file: { path: string },
				fn: (fm: Record<string, unknown>) => void,
			) => {
				const fixture = files.find((f) => f.path === file.path);
				if (fixture?.frontmatter) fn(fixture.frontmatter);
			},
		},
	} as unknown as App;
}

export function item(
	text: string,
	quantity: number | null,
	unit: string | null,
	extra: Partial<ShoppingItem> = {},
): ShoppingItem {
	return {
		id: "0",
		text,
		quantity,
		unit,
		checked: false,
		category: "Uncategorized",
		source: "recipe",
		...extra,
	};
}

export function recipeFixture(
	path: string,
	overrides: Partial<{ cook_soon: boolean; cook_multiplier: number; title: string }> = {},
) {
	return {
		path,
		cook_soon: false,
		cook_multiplier: 1,
		title: path.split("/").pop()!.replace(/\.md$/, ""),
		__tags: [] as string[],
		...overrides,
	};
}
