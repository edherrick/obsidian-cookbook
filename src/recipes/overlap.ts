import type { ParsedIngredient } from "../ingredients/parse";
import type { ShoppingCategory } from "../types";
import type { Vocabulary } from "../vocab/vocabulary";
import { assignCategory } from "../ingredients/categorize";
import { normalizeIngredientName } from "../ingredients/normalize";

export interface OverlapOptions {
	vocab: Vocabulary;
	categories: ShoppingCategory[];
	/** Aisles whose contents say nothing about overlap — spices, pantry staples. */
	ignoreCategories: string[];
}

export interface OverlapMatch {
	path: string;
	/** Short display names of the shared ingredients. */
	shared: string[];
	score: number;
}

/**
 * The ingredients that make a recipe distinctive enough to compare: everything
 * except staples and the ignored aisles. Keyed by the vocabulary's ingredient
 * key, valued by a short display name ("shredded curly kale" → "curly kale").
 */
export function distinctiveIngredients(
	ingredients: ParsedIngredient[],
	options: OverlapOptions,
): Map<string, string> {
	const ignore = new Set(options.ignoreCategories);
	const keys = new Map<string, string>();
	for (const ing of ingredients) {
		if (!ing.text || options.vocab.isStaple(ing.text)) continue;
		const canonical = options.vocab.canonicalText(ing.text);
		if (ignore.has(assignCategory(canonical, options.categories))) continue;
		const key = options.vocab.ingredientKey(ing.text);
		if (key && !keys.has(key)) keys.set(key, normalizeIngredientName(canonical) || canonical);
	}
	return keys;
}

/**
 * Rank recipes by how many distinctive ingredients they share with a target.
 *
 * The shared count is the score — two recipes sharing squash, kale and shallot
 * shop and prep together better than two sharing one thing, whatever their
 * size. Jaccard similarity only breaks ties, favouring the tighter match.
 */
export function rankOverlap(
	target: Map<string, string>,
	candidates: Map<string, Map<string, string>>,
	exclude: ReadonlySet<string> = new Set(),
): OverlapMatch[] {
	const ranked: (OverlapMatch & { jaccard: number })[] = [];
	for (const [path, keys] of candidates) {
		if (exclude.has(path)) continue;
		const shared = [...target.keys()].filter((k) => keys.has(k));
		if (shared.length === 0) continue;
		const union = new Set([...target.keys(), ...keys.keys()]).size;
		ranked.push({
			path,
			shared: shared.map((k) => target.get(k)!),
			score: shared.length,
			jaccard: shared.length / union,
		});
	}
	ranked.sort((a, b) => b.score - a.score || b.jaccard - a.jaccard || a.path.localeCompare(b.path));
	return ranked.map(({ path, shared, score }) => ({ path, shared, score }));
}

/** Everything a set of recipes uses between them — the target for "cooks well with this set". */
export function unionIngredients(
	paths: string[],
	byPath: Map<string, Map<string, string>>,
): Map<string, string> {
	const union = new Map<string, string>();
	for (const path of paths) {
		for (const [k, v] of byPath.get(path) ?? []) if (!union.has(k)) union.set(k, v);
	}
	return union;
}
