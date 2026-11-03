import type { KeywordGroup, LegacyKeywordLists } from "../types";

type LegacyGroup = LegacyKeywordLists["ingredientGroups"][number];
import { normalizeIngredientName } from "./normalize";

export const UNCATEGORIZED = "Uncategorized";

/** Per keyword: a pattern to test with, and a global one to find every occurrence. */
const regexCache = new Map<string, { test: RegExp; all: RegExp }>();

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does `keyword` occur in `text` as a whole word?
 *
 * Whole-word matching is the point: a plain substring test puts "horseradish
 * cheddar" in Produce (via "radish"), "rotini" in Pantry (via "tin") and
 * "peanut butter" in Produce (via "pea"). A trailing "s"/"es" is tolerated so a
 * singular keyword still matches a pluralised ingredient.
 */
export function matchKeyword(text: string, keyword: string): boolean {
	return keywordRegex(keyword)?.test.test(text) ?? false;
}

/**
 * Where `keyword` occurs in `text` as a whole word, as [start, end) offsets.
 * Used to tell when a match sits inside a longer one ("milk" in "coconut milk").
 */
export function keywordSpans(text: string, keyword: string): [number, number][] {
	const re = keywordRegex(keyword)?.all;
	if (!re) return [];
	re.lastIndex = 0;
	const spans: [number, number][] = [];
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		spans.push([m.index, m.index + m[0].length]);
		if (m[0].length === 0) re.lastIndex++;
	}
	return spans;
}

/** The whole-word patterns for a keyword, or null for an empty one. */
function keywordRegex(keyword: string): { test: RegExp; all: RegExp } | null {
	const kw = keyword.toLowerCase().trim();
	if (!kw) return null;

	let re = regexCache.get(kw);
	if (!re) {
		// Flexible internal whitespace so "fl oz" matches "fl  oz"
		const body = escapeRegex(kw).replace(/\\?\s+/g, "\\s+");
		const source = `\\b${body}(?:e?s)?\\b`;
		re = { test: new RegExp(source, "i"), all: new RegExp(source, "gi") };
		regexCache.set(kw, re);
	}
	return re;
}

/**
 * Pick the category whose keywords best describe an ingredient.
 *
 * The *longest* matching keyword across all categories wins, so a specific
 * keyword beats a generic one regardless of category order — "coconut milk"
 * (Pantry) beats "milk" (Dairy). Categories are only consulted in order to
 * break ties between equally specific keywords.
 */
export function assignCategory(text: string, categories: KeywordGroup[]): string {
	const key = normalizeIngredientName(text);
	if (!key) return UNCATEGORIZED;

	let bestName = UNCATEGORIZED;
	let bestLen = 0;

	for (const cat of categories) {
		for (const kw of cat.keywords) {
			const len = kw.trim().length;
			// Strictly greater keeps the earlier category on a tie
			if (len > bestLen && matchKeyword(key, kw)) {
				bestLen = len;
				bestName = cat.name;
			}
		}
	}

	return bestName;
}

/** Does any of these keywords describe this ingredient? */
export function matchesAnyKeyword(text: string, keywords: string[]): boolean {
	const key = normalizeIngredientName(text);
	if (!key) return false;
	return keywords.some((kw) => matchKeyword(key, kw));
}

/**
 * Does this ingredient belong to a dietary group?
 *
 * A keyword must match and no exclusion may. Because this runs per ingredient
 * line, a plain "any exclusion wins" rule is correct: a recipe listing both
 * "peanut butter" and "2 tbsp butter" still reads as Dairy via the second line.
 */
export function matchesGroup(text: string, group: LegacyGroup): boolean {
	const key = normalizeIngredientName(text);
	if (!key) return false;
	if (!group.keywords.some((kw) => matchKeyword(key, kw))) return false;
	return !group.excludeKeywords?.some((kw) => matchKeyword(key, kw));
}
