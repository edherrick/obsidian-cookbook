/**
 * What the recipe browser shows and filters on, from a recipe's frontmatter.
 * Uses the same optional properties as cooking sessions: `prep-time` and
 * `cook-time` in minutes, `rating` out of 5, `cuisine`, `meal-type`, `tried`.
 */

type RecipeFields = Record<string, unknown>;

/** Shown in their own way, or as the title, so never repeated as an extra. */
const BUILT_IN = ["title", "prep-time", "cook-time", "rating", "cuisine", "tried", "meal-type"];

const minutes = (v: unknown): number => {
	const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
	return Number.isFinite(n) && n > 0 ? n : 0;
};

const text = (v: unknown): string => {
	if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
	if (typeof v === "string") return v.trim();
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return "";
};

/** "45 min", "1 h", "1 h 15 min". */
export function formatMinutes(total: number): string {
	const h = Math.floor(total / 60);
	const m = Math.round(total % 60);
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * The short facts a recipe card shows under its title: total time, rating,
 * cuisine, then any other properties chosen in settings.
 */
export function cardMeta(recipe: RecipeFields, extraKeys: readonly string[] = []): string[] {
	const parts: string[] = [];
	const total = minutes(recipe["prep-time"]) + minutes(recipe["cook-time"]);
	if (total > 0) parts.push(formatMinutes(total));
	const rating = minutes(recipe.rating);
	if (rating > 0) parts.push(`★ ${rating}`);
	const cuisine = text(recipe.cuisine);
	if (cuisine) parts.push(cuisine);
	for (const key of extraKeys) {
		if (BUILT_IN.includes(key)) continue;
		const value = text(recipe[key]);
		if (value) parts.push(typeof recipe[key] === "number" ? `${key} ${value}` : value);
	}
	return parts;
}

/** Not marked tried. Only meaningful when the recipe has a `tried` property at all. */
export function isUntried(recipe: RecipeFields): boolean {
	return "tried" in recipe && recipe.tried !== true && recipe.tried !== "true";
}

/** Meal types across recipes, most used first. */
export function mealTypes(recipes: readonly RecipeFields[]): string[] {
	const counts = new Map<string, number>();
	for (const r of recipes) {
		const raw = r["meal-type"];
		for (const v of Array.isArray(raw) ? raw : [raw]) {
			const t = text(v);
			if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
		}
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export interface QuickFilter {
	/** Matched against the title and cuisine. */
	query: string;
	cookSoon: boolean;
	untried: boolean;
	/** A recipe matches if it has any of these. */
	mealTypes: string[];
}

export const NO_QUICK_FILTER: QuickFilter = { query: "", cookSoon: false, untried: false, mealTypes: [] };

export function matchesQuickFilter(recipe: RecipeFields, f: QuickFilter): boolean {
	const q = f.query.trim().toLowerCase();
	if (q && ![text(recipe.title), text(recipe.cuisine)].some((s) => s.toLowerCase().includes(q))) return false;
	if (f.cookSoon && !recipe.cook_soon) return false;
	if (f.untried && !isUntried(recipe)) return false;
	if (f.mealTypes.length > 0) {
		const raw = recipe["meal-type"];
		const types = (Array.isArray(raw) ? raw : [raw]).map(text);
		if (!f.mealTypes.some((t) => types.includes(t))) return false;
	}
	return true;
}
