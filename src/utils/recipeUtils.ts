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

// ─── Unit conversion tables ───────────────────────────────────────────────────

function buildUnitTable(entries: { factor: number; aliases: string[] }[]): Record<string, number> {
	const table: Record<string, number> = {};
	for (const { factor, aliases } of entries) {
		for (const alias of aliases) table[alias] = factor;
	}
	return table;
}

/** Volume units → ml */
const VOLUME_ML = buildUnitTable([
	{ factor: 4.92,     aliases: ["tsp", "teaspoon", "teaspoons"] },
	{ factor: 14.79,    aliases: ["tbsp", "tablespoon", "tablespoons", "tbs"] },
	{ factor: 29.57,    aliases: ["fl oz", "fluid oz"] },
	{ factor: 236.59,   aliases: ["cup", "cups"] },
	{ factor: 473.18,   aliases: ["pt", "pint", "pints"] },
	{ factor: 946.35,   aliases: ["qt", "quart", "quarts"] },
	{ factor: 3785.41,  aliases: ["gal", "gallon", "gallons"] },
	{ factor: 1,        aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"] },
	{ factor: 1000,     aliases: ["l", "liter", "liters", "litre", "litres"] },
]);

/** Weight units → g */
const WEIGHT_G = buildUnitTable([
	{ factor: 1,      aliases: ["g", "gram", "grams"] },
	{ factor: 1000,   aliases: ["kg", "kilogram", "kilograms"] },
	{ factor: 28.35,  aliases: ["oz", "ounce", "ounces"] },
	{ factor: 453.59, aliases: ["lb", "lbs", "pound", "pounds"] },
]);

function getUnitDimension(unit: string): "volume" | "weight" | null {
	const u = unit.toLowerCase();
	if (u in VOLUME_ML) return "volume";
	if (u in WEIGHT_G) return "weight";
	return null;
}

function toBaseUnit(qty: number, unit: string): number {
	const u = unit.toLowerCase();
	return qty * (VOLUME_ML[u] ?? WEIGHT_G[u] ?? 1);
}

/** Convert a base amount (ml or g) back to the preferred display unit. */
function fromBaseUnit(base: number, dimension: "volume" | "weight", preferUnit: string): { qty: number; unit: string } {
	const table = dimension === "volume" ? VOLUME_ML : WEIGHT_G;
	const factor = table[preferUnit.toLowerCase()];
	if (factor) return { qty: roundQty(base / factor), unit: preferUnit };
	// Fallback
	if (dimension === "volume") {
		if (base >= 236.59) return { qty: roundQty(base / 236.59), unit: "cups" };
		if (base >= 14.79) return { qty: roundQty(base / 14.79), unit: "tbsp" };
		return { qty: roundQty(base / 4.92), unit: "tsp" };
	} else {
		if (base >= 1000) return { qty: roundQty(base / 1000), unit: "kg" };
		return { qty: roundQty(base), unit: "g" };
	}
}

function roundQty(n: number): number {
	return Math.round(n * 100) / 100;
}

// ─── Ingredient parsing ───────────────────────────────────────────────────────

interface ParsedIngredient {
	quantity: number | null;
	unit: string | null;
	text: string;
}

/**
 * Parse a raw ingredient string into quantity, unit, and name.
 * Handles integers, decimals, fractions (1/2), mixed numbers (1 1/2),
 * ranges (2-3 → first value), and approximate markers (~).
 * Unit is only extracted if it matches a known cooking unit.
 */
export function parseIngredient(raw: string): ParsedIngredient {
	// Strip leading approximate marker
	let s = raw.replace(/^~\s*/, "").trim();

	let quantity: number | null = null;
	let rest = s;

	// Mixed number: "1 1/2 cups"
	const mixedRe = /^(\d+)\s+(\d+)\/(\d+)(?:\s+|(?=[a-zA-Z]))/;
	// Simple fraction: "1/2 cup"
	const fracRe = /^(\d+)\/(\d+)(?:\s+|(?=[a-zA-Z]))/;
	// Range: "2-3 cloves" → take first value
	const rangeRe = /^(\d+(?:\.\d+)?)-\d+(?:\.\d+)?(?:\s+|(?=[a-zA-Z]))/;
	// Integer or decimal: "2 cups" or "100g"
	const numRe = /^(\d+(?:\.\d+)?)(?:\s+|(?=[a-zA-Z]))/;

	let qm: RegExpExecArray | null;
	if ((qm = mixedRe.exec(s))) {
		quantity = parseInt(qm[1]!) + parseInt(qm[2]!) / parseInt(qm[3]!);
		rest = s.slice(qm[0].length);
	} else if ((qm = fracRe.exec(s))) {
		quantity = parseInt(qm[1]!) / parseInt(qm[2]!);
		rest = s.slice(qm[0].length);
	} else if ((qm = rangeRe.exec(s))) {
		quantity = parseFloat(qm[1]!);
		rest = s.slice(qm[0].length);
	} else if ((qm = numRe.exec(s))) {
		quantity = parseFloat(qm[1]!);
		rest = s.slice(qm[0].length);
	}

	if (quantity === null) return { quantity: null, unit: null, text: s };

	// Try to match a known unit at the start of rest (two-word first, then one-word)
	const words = rest.trim().split(/\s+/);
	let unit: string | null = null;
	let textWords = words;

	if (words.length >= 2) {
		const twoWord = `${words[0]} ${words[1]}`.toLowerCase();
		if (twoWord in VOLUME_ML) {
			unit = twoWord;
			textWords = words.slice(2);
		}
	}
	if (!unit && words.length >= 1) {
		const oneWord = words[0]!.toLowerCase();
		if (oneWord in VOLUME_ML || oneWord in WEIGHT_G) {
			unit = oneWord;
			textWords = words.slice(1);
		}
	}

	const text = (textWords.length > 0 ? textWords.join(" ") : rest).trim();
	return { quantity, unit, text: text || rest.trim() };
}

export interface DisplayUnitPrefs {
	preferredVolumeUnit?: string;
	preferredWeightUnit?: string;
}

export async function buildShoppingList(
	app: App,
	recipes: Recipe[],
	categories: ShoppingCategory[],
	unitPrefs?: DisplayUnitPrefs,
): Promise<PersistedShoppingList> {
	const checkboxRe = /^[-*]\s*\[[ xX]?\]\s*(.+)$/gm;

	const cookSoonRecipes = recipes
		.filter((r) => r.cook_soon)
		.map((r) => ({ recipe: r, file: app.vault.getAbstractFileByPath(r.path) }))
		.filter((e): e is { recipe: Recipe; file: TFile } => e.file instanceof TFile);

	// Read all recipe files in parallel
	const perRecipeItems = await Promise.all(
		cookSoonRecipes.map(async ({ recipe, file }) => {
			const items: ShoppingItem[] = [];
			try {
				const text = await app.vault.read(file);
				const re = new RegExp(checkboxRe.source, checkboxRe.flags);
				let m: RegExpExecArray | null;
				while ((m = re.exec(text)) !== null) {
					const raw = m[1]!.trim();
					const parsed = parseIngredient(raw);
					const multiplier = recipe.cook_multiplier ?? 1;
					const quantity = parsed.quantity !== null ? roundQty(parsed.quantity * multiplier) : null;
					items.push({
						id: "",
						text: parsed.text,
						quantity,
						unit: parsed.unit,
						checked: false,
						category: assignCategory(parsed.text, categories),
						source: "recipe",
						recipeTitle: recipe.title,
					});
				}
			} catch (e) {
				console.error("buildShoppingList: failed reading", recipe.path, e);
			}
			return items;
		}),
	);

	// Flatten and assign stable ids
	const items = perRecipeItems.flat().map((item, i) => ({ ...item, id: String(i) }));

	const categoryOrder = [
		...categories.map((c) => c.name),
		"Uncategorized",
	];

	return { items: aggregateItems(items, unitPrefs), categoryOrder, generatedAt: Date.now() };
}

/**
 * Aggregate shopping items by name + unit dimension.
 * - Same unit: quantities are summed directly.
 * - Different units, same dimension (both volume or both weight):
 *   converted to a base unit, summed, and displayed in the first item's unit.
 * - Incompatible units (volume vs weight): kept as separate entries.
 * - Items without units: aggregated by name only (existing behaviour).
 */
function aggregateItems(items: ShoppingItem[], prefs?: DisplayUnitPrefs): ShoppingItem[] {
	const map = new Map<string, ShoppingItem>();
	for (const item of items) {
		const nameKey = item.text.toLowerCase().replace(/\s+/g, " ").trim();
		const dimension = item.unit ? getUnitDimension(item.unit) : null;
		// Items with incompatible units get separate keys so they don't merge
		const key = dimension ? `${nameKey}::${dimension}` : nameKey;

		const existing = map.get(key);
		if (existing) {
			if (existing.quantity !== null && item.quantity !== null) {
				if (!existing.unit || !item.unit || existing.unit === item.unit) {
					// No units or same unit — plain addition
					existing.quantity = roundQty(existing.quantity + item.quantity);
				} else if (dimension) {
					// Different units, same dimension — convert via base
					const base = toBaseUnit(existing.quantity, existing.unit) + toBaseUnit(item.quantity, item.unit);
					const preferUnit = dimension === "volume"
						? (prefs?.preferredVolumeUnit || existing.unit)
						: (prefs?.preferredWeightUnit || existing.unit);
					const converted = fromBaseUnit(base, dimension, preferUnit);
					existing.quantity = converted.qty;
					existing.unit = converted.unit;
				}
			} else if (item.quantity !== null) {
				existing.quantity = item.quantity;
				existing.unit = item.unit;
			}
			if (item.recipeTitle && item.recipeTitle !== existing.recipeTitle) {
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
