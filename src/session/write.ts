import { normalizePath, TFile } from "obsidian";
import type { App } from "obsidian";
import type { Recipe } from "../recipes/repository";
import type { IngredientCache } from "../ingredients/cache";
import type { DisplayUnitPrefs } from "../ingredients/aggregate";
import type { Vocabulary } from "../vocab/vocabulary";
import { buildSessionNote } from "./build";
import type { SessionRecipe } from "./build";
import { parsePlan, planSteps } from "./plan";
import type { PlanEntry, PlannedStep } from "./plan";

export interface CookSessionOptions {
	folder: string;
	vocab: Vocabulary;
	cache: IngredientCache;
	unitPrefs?: DisplayUnitPrefs;
	/** Defaults to today. */
	date?: Date;
}

/** A session note and what it is made of, ready to arrange or write. */
export interface CookSession {
	path: string;
	/** YYYY-MM-DD */
	date: string;
	recipes: SessionRecipe[];
	/** The steps in their saved (or default) order. */
	steps: PlannedStep[];
}

/** The obsidian:// link that reopens the arrange modal for a session note. */
export function arrangeLink(app: App, path: string): string {
	const q = new URLSearchParams({ vault: app.vault.getName(), file: path });
	return `obsidian://cookbook-arrange?${q.toString().replace(/\+/g, "%20")}`;
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

export async function toSessionRecipe(
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

function savedPlan(app: App, path: string): PlanEntry[] | undefined {
	const file = app.vault.getFileByPath(path);
	const fm: unknown = file ? app.metadataCache.getFileCache(file)?.frontmatter?.["cook-plan"] : undefined;
	return parsePlan(fm);
}

/**
 * Today's session for these recipes. If today's note already exists its
 * saved cook order is kept, so starting the session again doesn't undo the
 * arranging.
 */
export async function prepareCookSession(
	app: App,
	recipes: Recipe[],
	options: Pick<CookSessionOptions, "folder" | "cache" | "date">,
): Promise<CookSession> {
	const date = isoDate(options.date ?? new Date());
	const folder = normalizePath(options.folder.trim() || "/");
	const path = normalizePath(`${folder === "/" ? "" : `${folder}/`}Cook session ${date}.md`);
	const sessionRecipes = (
		await Promise.all(recipes.map((r) => toSessionRecipe(app, r, options.cache)))
	).filter((r): r is SessionRecipe => r !== null);
	return { path, date, recipes: sessionRecipes, steps: planSteps(sessionRecipes, savedPlan(app, path)) };
}

/**
 * Rebuild a session from its note: the recipes it links in `recipes:` and its
 * saved cook order. Null when the note links no recipe that still exists.
 */
export async function loadCookSession(
	app: App,
	file: TFile,
	options: { cache: IngredientCache; findRecipe: (path: string) => Recipe | undefined },
): Promise<CookSession | null> {
	const cache = app.metadataCache.getFileCache(file);
	const links = (cache?.frontmatterLinks ?? []).filter((l) => /^recipes(?:\.\d+)?$/.test(l.key));
	const recipes: Recipe[] = [];
	for (const l of links) {
		const dest = app.metadataCache.getFirstLinkpathDest(l.link, file.path);
		const recipe = dest ? options.findRecipe(dest.path) : undefined;
		if (recipe && !recipes.includes(recipe)) recipes.push(recipe);
	}
	if (recipes.length === 0) return null;

	const sessionRecipes = (
		await Promise.all(recipes.map((r) => toSessionRecipe(app, r, options.cache)))
	).filter((r): r is SessionRecipe => r !== null);
	const fmDate: unknown = cache?.frontmatter?.date;
	const date =
		typeof fmDate === "string" && fmDate ? fmDate : /(\d{4}-\d{2}-\d{2})/.exec(file.basename)?.[1] ?? "";
	return {
		path: file.path,
		date,
		recipes: sessionRecipes,
		steps: planSteps(sessionRecipes, savedPlan(app, file.path)),
	};
}

/**
 * Write (or regenerate) a session note with the given cook order. Everything
 * above "My notes" is rewritten; what was written under it is kept.
 */
export async function writeCookSessionNote(
	app: App,
	session: CookSession,
	plan: PlanEntry[],
	options: Pick<CookSessionOptions, "vocab" | "unitPrefs">,
): Promise<TFile> {
	const { path } = session;
	const existing = app.vault.getAbstractFileByPath(path);
	const existingContent = existing instanceof TFile ? await app.vault.read(existing) : undefined;

	const content = buildSessionNote(session.recipes, {
		vocab: options.vocab,
		date: session.date,
		unitPrefs: options.unitPrefs,
		existingContent,
		plan,
		arrangeLink: arrangeLink(app, path),
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
	const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (folder) await ensureFolder(app, folder);
	return app.vault.create(path, content);
}
