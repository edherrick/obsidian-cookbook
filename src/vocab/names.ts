import type { Ingredient } from "../types";
import type { ParsedIngredient } from "../ingredients/parse";
import type { Vocabulary } from "./vocabulary";
import { normalizeIngredientName } from "../ingredients/normalize";

export interface IngredientName {
	/** Display name: the canonical name, or the first spelling seen. */
	name: string;
	key: string;
	/** Titles of the recipes that use it. */
	recipes: string[];
}

/** Every distinct ingredient across the given recipes, as the vocabulary sees them. */
export function indexIngredientNames(
	byRecipe: [title: string, ingredients: ParsedIngredient[]][],
	vocab: Vocabulary,
): IngredientName[] {
	const index = new Map<string, IngredientName>();
	for (const [title, ingredients] of byRecipe) {
		for (const ing of ingredients) {
			if (!ing.text) continue;
			const key = vocab.ingredientKey(ing.text);
			if (!key) continue;
			const entry = index.get(key) ?? {
				name: normalizeIngredientName(vocab.canonicalText(ing.text)) || key,
				key,
				recipes: [],
			};
			if (!entry.recipes.includes(title)) entry.recipes.push(title);
			index.set(key, entry);
		}
	}
	return [...index.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function editDistance(a: string, b: string): number {
	const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let diag = prev[0]!;
		prev[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = prev[j]!;
			prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
			diag = tmp;
		}
	}
	return prev[b.length]!;
}

/**
 * Names that are probably one ingredient: a whole-word suffix of another
 * ("apple" / "red apple") or a near-identical spelling ("ceasar" / "caesar").
 * Suggestions only — "feta cheese" and "cheddar cheese" share a word and are
 * rightly left apart.
 */
export function likelyDuplicates(names: IngredientName[]): Map<string, string[]> {
	const out = new Map<string, string[]>();
	const add = (from: IngredientName, to: IngredientName) => {
		const list = out.get(from.key) ?? [];
		if (!list.includes(to.name)) list.push(to.name);
		out.set(from.key, list);
	};
	for (let i = 0; i < names.length; i++) {
		for (let j = i + 1; j < names.length; j++) {
			const a = names[i]!;
			const b = names[j]!;
			const [short, long] = a.key.length <= b.key.length ? [a, b] : [b, a];
			const suffix = long.key.endsWith(` ${short.key}`);
			const typo = short.key.length >= 5 && editDistance(a.key, b.key) <= 2;
			if (suffix || typo) {
				add(a, b);
				add(b, a);
			}
		}
	}
	return out;
}

/**
 * Record that `source` is another name for `target` in the ingredient list.
 *
 * If `source` was an ingredient of its own, it's folded in and its other names
 * move along, so merging never strands a name. If `target` isn't listed yet,
 * it's added, keeping the source's category and tags.
 */
export function mergeIngredientName(ingredients: Ingredient[], source: string, target: string): void {
	const src = source.trim();
	const dst = target.trim();
	const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
	if (!src || !dst || same(src, dst)) return;

	const absorbed = ingredients.find((i) => same(i.name, src));

	let into = ingredients.find((i) => same(i.name, dst));
	if (!into) {
		into = {
			name: dst,
			otherNames: [],
			category: absorbed?.category ?? "",
			groups: [...(absorbed?.groups ?? [])],
			...(absorbed?.staple ? { staple: true } : {}),
		};
		ingredients.push(into);
	}
	if (absorbed) ingredients.splice(ingredients.indexOf(absorbed), 1);

	// The source may also be listed as another name elsewhere; it now belongs here
	for (const other of ingredients) {
		if (other !== into) other.otherNames = other.otherNames.filter((n) => !same(n, src));
	}
	for (const name of [src, ...(absorbed?.otherNames ?? [])]) {
		if (!same(name, into.name) && !into.otherNames.some((n) => same(n, name))) into.otherNames.push(name);
	}
}
