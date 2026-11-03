import type { Ingredient, LegacyKeywordLists } from "../types";
import { assignCategory, matchesGroup, matchKeyword, UNCATEGORIZED } from "../ingredients/categorize";
import { normalizeIngredientName } from "../ingredients/normalize";
import { saysFreeOf } from "../ingredients/catalog";

/**
 * Turn the old keyword lists into one ingredient list.
 *
 * Every word any list mentioned becomes an ingredient: category keywords,
 * dietary keywords and exclusions, staples and aliases. Each one's category,
 * groups and staple flag come from running the old rules on its own name, so
 * a recipe line is described the same way before and after. An exclusion such
 * as "coconut milk" in Dairy becomes an ingredient without Dairy, and being
 * the longer match, it keeps "milk" from counting.
 *
 * Alias keywords become other names of their ingredient, not ingredients of
 * their own, so they keep merging into it on the shopping list.
 */
export function ingredientsFromKeywordLists(old: LegacyKeywordLists): Ingredient[] {
	const { shoppingCategories, ingredientGroups, ingredientAliases, stapleIngredients } = old;
	const lower = (s: string) => s.trim().toLowerCase();

	// Other names, mapped to the ingredient they belong to
	const aliasOf = new Map<string, string>();
	for (const alias of ingredientAliases) {
		const name = alias.name.trim();
		if (!name) continue;
		for (const other of alias.keywords) {
			const key = lower(other);
			if (key && key !== lower(name) && !aliasOf.has(key)) aliasOf.set(key, name);
		}
	}

	// Every name, in the order the lists give them: categories first, so
	// ingredients read in aisle order
	const names: string[] = [];
	const seen = new Set<string>();
	const add = (raw: string) => {
		const name = raw.trim();
		const key = lower(name);
		if (!name || seen.has(key) || aliasOf.has(key)) return;
		seen.add(key);
		names.push(name);
	};
	for (const c of shoppingCategories) c.keywords.forEach(add);
	for (const g of ingredientGroups) {
		g.keywords.forEach(add);
		// "gluten-free" is a modifier, not an ingredient: the catalog reads it
		// from the group's name (see saysFreeOf)
		g.excludeKeywords?.filter((e) => !saysFreeOf(e, g.name)).forEach(add);
	}
	stapleIngredients.forEach(add);
	for (const a of ingredientAliases) add(a.name);

	const isStaple = (name: string) => {
		const key = normalizeIngredientName(name);
		return stapleIngredients.some((s) => matchKeyword(name.toLowerCase(), s) || matchKeyword(key, s));
	};

	return names.map((name) => {
		const otherNames = ingredientAliases
			.filter((a) => lower(a.name) === lower(name))
			.flatMap((a) => a.keywords.map((k) => k.trim()))
			.filter((k, i, all) => k && lower(k) !== lower(name) && all.findIndex((x) => lower(x) === lower(k)) === i);
		const allNames = [name, ...otherNames];
		// An alias's own name may not be a keyword ("scallion") when one of its
		// other names is ("spring onion"), so the first that has a category wins
		const category = allNames.map((n) => assignCategory(n, shoppingCategories)).find((c) => c !== UNCATEGORIZED);
		const ingredient: Ingredient = {
			name,
			otherNames,
			category: category ?? "",
			// Every name's groups count: missing an allergen is worse than an extra one
			groups: ingredientGroups.filter((g) => allNames.some((n) => matchesGroup(n, g))).map((g) => g.name),
		};
		if (allNames.some(isStaple)) ingredient.staple = true;
		return ingredient;
	});
}

/** Whether raw saved data predates the ingredient list and needs converting. */
export function needsIngredientMigration(raw: Record<string, unknown>): boolean {
	if (Array.isArray(raw.ingredients)) return false;
	const categories = raw.shoppingCategories;
	return (
		(Array.isArray(categories) && categories.some((c) => Array.isArray((c as { keywords?: unknown }).keywords))) ||
		Array.isArray(raw.ingredientAliases) ||
		Array.isArray(raw.stapleIngredients)
	);
}

/** Pick the old lists out of raw saved data, falling back to `defaults` for any that are missing. */
export function legacyListsFrom(raw: Record<string, unknown>, defaults: LegacyKeywordLists): LegacyKeywordLists {
	const list = <K extends keyof LegacyKeywordLists>(key: K): LegacyKeywordLists[K] =>
		Array.isArray(raw[key]) ? (raw[key] as LegacyKeywordLists[K]) : defaults[key];
	return {
		shoppingCategories: list("shoppingCategories").map((c) => ({ name: c.name, keywords: c.keywords ?? [] })),
		ingredientGroups: list("ingredientGroups").map((g) => ({ ...g, keywords: g.keywords ?? [] })),
		ingredientAliases: list("ingredientAliases"),
		stapleIngredients: list("stapleIngredients"),
	};
}

