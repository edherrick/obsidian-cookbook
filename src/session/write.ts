import { normalizePath, TFile } from "obsidian";
import type { App } from "obsidian";
import type { Recipe } from "../recipes/repository";
import type { IngredientCache } from "../ingredients/cache";
import type { DisplayUnitPrefs } from "../ingredients/aggregate";
import type { Vocabulary } from "../vocab/vocabulary";
import { buildSessionNote } from "./build";
import type { SessionRecipe } from "./build";

export interface CookSessionOptions {
	folder: string;
	vocab: Vocabulary;
	cache: IngredientCache;
	unitPrefs?: DisplayUnitPrefs;
	/** Defaults to today. */
	date?: Date;
}

function isoDate(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function num(v: unknown): number | undefined {
	const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
	return isFinite(n) ? n : undefined;
}

function list(v: unknown): string[] {
	if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x.trim().length > 0);
	return typeof v === "string" && v.trim() ? [v] : [];
}

async function toSessionRecipe(
	app: App,
	recipe: Recipe,
	cache: IngredientCache,
): Promise<SessionRecipe | null> {
	const file = app.vault.getFileByPath(recipe.path);
	if (!file) return null;
	const servings: unknown = recipe["serving-size"] ?? recipe.servings;
	return {
		path: recipe.path,
		title: recipe.title,
		content: await app.vault.cachedRead(file),
		ingredients: await cache.get(app, recipe),
		multiplier: recipe.cook_multiplier ?? 1,
		ovenTemp: num(recipe["oven-temp"]),
		prepTime: num(recipe["prep-time"]),
		cookTime: num(recipe["cook-time"]),
		servings:
			typeof servings === "number" || typeof servings === "string" ? String(servings) : undefined,
		equipment: list(recipe.equipment),
		fridgeDays: num(recipe["fridge-days"]),
		freezerMonths: num(recipe["freezer-months"]),
	};
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	let path = "";
	for (const part of folder.split("/").filter(Boolean)) {
		path = path ? `${path}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
	}
}

/**
 * Write (or regenerate) today's cook session note and return it. A second
 * session on the same day rewrites the generated part of the same note and
 * keeps whatever was written under "My notes".
 */
export async function writeCookSession(
	app: App,
	recipes: Recipe[],
	options: CookSessionOptions,
): Promise<TFile> {
	const date = isoDate(options.date ?? new Date());
	const folder = normalizePath(options.folder.trim() || "/");
	const path = normalizePath(`${folder === "/" ? "" : `${folder}/`}Cook session ${date}.md`);

	const sessionRecipes = (
		await Promise.all(recipes.map((r) => toSessionRecipe(app, r, options.cache)))
	).filter((r): r is SessionRecipe => r !== null);

	const existing = app.vault.getAbstractFileByPath(path);
	const existingContent = existing instanceof TFile ? await app.vault.read(existing) : undefined;

	const content = buildSessionNote(sessionRecipes, {
		vocab: options.vocab,
		date,
		unitPrefs: options.unitPrefs,
		existingContent,
		linkTo: (r) => {
			const file = app.vault.getFileByPath(r.path);
			if (!file) return `[[${r.path.replace(/\.md$/, "")}|${r.title}]]`;
			// Shortest unambiguous link, as Obsidian itself would write it
			const linktext = app.metadataCache.fileToLinktext(file, path, true);
			return linktext === r.title ? `[[${linktext}]]` : `[[${linktext}|${r.title}]]`;
		},
	});

	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return existing;
	}
	if (folder !== "/") await ensureFolder(app, folder);
	return app.vault.create(path, content);
}
