import type { Recipe } from "../recipes/repository";
import type { ParsedIngredient } from "../ingredients/parse";
import type { IngredientGroup } from "../types";
import { matchesAnyKeyword } from "../ingredients/categorize";

export const HAS_INGREDIENT_KEY = "__has-ingredient";
export const EXCLUDES_INGREDIENT_KEY = "__excludes-ingredient";
export const HAS_GROUP_KEY = "__has-group";
export const EXCLUDES_GROUP_KEY = "__excludes-group";

export const SYNTHETIC_FILTER_KEYS: readonly string[] = [
	HAS_INGREDIENT_KEY,
	EXCLUDES_INGREDIENT_KEY,
	HAS_GROUP_KEY,
	EXCLUDES_GROUP_KEY,
];

export interface FilterMeta {
	values: string[];
	isNumeric: boolean;
}

export type StringFilter = { type: "string"; value: string };
export type NumericFilter = { type: "numeric"; op: "<" | "=" | ">"; value: string };
export type HasIngredientFilter = {
	type: "has-ingredient";
	ingredients: string[];
	logic: "and" | "or";
};
export type ExcludesIngredientFilter = { type: "excludes-ingredient"; ingredients: string[] };
export type HasGroupFilter = { type: "has-group"; groups: string[]; logic: "and" | "or" };
export type ExcludesGroupFilter = { type: "excludes-group"; groups: string[] };

export type FilterValue =
	| StringFilter
	| NumericFilter
	| HasIngredientFilter
	| ExcludesIngredientFilter
	| HasGroupFilter
	| ExcludesGroupFilter;

export interface FilterContext {
	ingredientsByPath: Map<string, ParsedIngredient[]>;
	ingredientGroups: IngredientGroup[];
}

/**
 * The comparable values of one frontmatter property.
 *
 * List properties yield one value per entry rather than a single joined
 * string — `meal-type: [Dinner, Vegetarian]` is two options, not the option
 * "Dinner,Vegetarian" that no other recipe will ever equal.
 */
export function toFilterValues(raw: unknown): string[] {
	if (raw === null || raw === undefined) return [];
	if (Array.isArray(raw)) {
		return (raw as unknown[]).map(scalarToString).filter((v) => v !== "");
	}
	const s = scalarToString(raw);
	return s === "" ? [] : [s];
}

/** Frontmatter scalars only — a nested object has no useful filter value. */
function scalarToString(v: unknown): string {
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
	return "";
}

function isAllNumeric(values: string[]): boolean {
	return values.length > 0 && values.every((v) => v !== "" && isFinite(Number(v)));
}

export function buildFilterOptions(
	recipeList: Recipe[],
	excludedKeys: ReadonlySet<string>,
): Map<string, FilterMeta> {
	const raw = new Map<string, string[]>();
	for (const r of recipeList) {
		for (const [k, v] of Object.entries(r)) {
			if (excludedKeys.has(k) || k.startsWith("__")) continue;
			const values = toFilterValues(v);
			if (values.length === 0) continue;
			const existing = raw.get(k) ?? [];
			for (const value of values) {
				if (!existing.includes(value)) existing.push(value);
			}
			raw.set(k, existing);
		}
	}

	const result = new Map<string, FilterMeta>();
	for (const [k, values] of raw) {
		result.set(k, { values: [...values].sort(), isNumeric: isAllNumeric(values) });
	}
	return result;
}

function ingredientTexts(recipe: Recipe, ctx: FilterContext): string[] {
	return (ctx.ingredientsByPath.get(recipe.path) ?? []).map((i) => i.text.toLowerCase());
}

function recipeHasGroup(recipe: Recipe, groupName: string, ctx: FilterContext): boolean {
	const group = ctx.ingredientGroups.find((g) => g.name === groupName);
	if (!group) return false;
	const ingredients = ctx.ingredientsByPath.get(recipe.path) ?? [];
	return ingredients.some((i) => matchesAnyKeyword(i.text, group.keywords));
}

export function recipeMatchesFilters(
	recipe: Recipe,
	filters: Map<string, FilterValue>,
	ctx: FilterContext,
): boolean {
	for (const [key, filter] of filters) {
		switch (filter.type) {
			case "string": {
				if (!filter.value) continue;
				// Membership, not equality — a list property matches on any entry
				if (!toFilterValues(recipe[key]).includes(filter.value)) return false;
				break;
			}
			case "numeric": {
				if (!filter.value) continue;
				const rNum = parseFloat(String(recipe[key] ?? ""));
				const fNum = parseFloat(filter.value);
				if (isNaN(rNum) || isNaN(fNum)) continue;
				if (filter.op === "<" && !(rNum < fNum)) return false;
				if (filter.op === "=" && rNum !== fNum) return false;
				if (filter.op === ">" && !(rNum > fNum)) return false;
				break;
			}
			case "has-ingredient": {
				if (filter.ingredients.length === 0) continue;
				const texts = ingredientTexts(recipe, ctx);
				const matches = filter.ingredients.map((q) => texts.some((t) => t.includes(q)));
				if (!(filter.logic === "and" ? matches.every(Boolean) : matches.some(Boolean))) {
					return false;
				}
				break;
			}
			case "excludes-ingredient": {
				if (filter.ingredients.length === 0) continue;
				const texts = ingredientTexts(recipe, ctx);
				if (filter.ingredients.some((q) => texts.some((t) => t.includes(q)))) return false;
				break;
			}
			case "has-group": {
				if (filter.groups.length === 0) continue;
				const matches = filter.groups.map((g) => recipeHasGroup(recipe, g, ctx));
				if (!(filter.logic === "and" ? matches.every(Boolean) : matches.some(Boolean))) {
					return false;
				}
				break;
			}
			case "excludes-group": {
				if (filter.groups.length === 0) continue;
				if (filter.groups.some((g) => recipeHasGroup(recipe, g, ctx))) return false;
				break;
			}
		}
	}
	return true;
}

export function initialFilterFor(key: string, meta?: FilterMeta): FilterValue {
	switch (key) {
		case HAS_INGREDIENT_KEY:
			return { type: "has-ingredient", ingredients: [], logic: "and" };
		case EXCLUDES_INGREDIENT_KEY:
			return { type: "excludes-ingredient", ingredients: [] };
		case HAS_GROUP_KEY:
			return { type: "has-group", groups: [], logic: "and" };
		case EXCLUDES_GROUP_KEY:
			return { type: "excludes-group", groups: [] };
		default:
			return meta?.isNumeric ? { type: "numeric", op: "=", value: "" } : { type: "string", value: "" };
	}
}
