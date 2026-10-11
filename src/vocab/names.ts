import type { IngredientAlias } from "../types";
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
 * Record that `source` is another name for `target`. The source's own
 * aliases move along with it, so merging never strands a name.
 */
export function mergeAlias(aliases: IngredientAlias[], source: string, target: string): void {
	const src = source.trim();
	const dst = target.trim();
	if (!src || !dst || src.toLowerCase() === dst.toLowerCase()) return;

	let group = aliases.find((a) => a.name.toLowerCase() === dst.toLowerCase());
	if (!group) {
		group = { name: dst, keywords: [] };
		aliases.push(group);
	}

	const absorbed = aliases.findIndex((a) => a !== group && a.name.toLowerCase() === src.toLowerCase());
	const moving = absorbed === -1 ? [src] : [src, ...aliases[absorbed]!.keywords];
	if (absorbed !== -1) aliases.splice(absorbed, 1);

	for (const name of moving) {
		if (!group.keywords.some((k) => k.toLowerCase() === name.toLowerCase())) {
			group.keywords.push(name);
		}
	}
}
