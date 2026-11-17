import type { ParsedIngredient } from "../ingredients/parse";
import { writtenPrep } from "../ingredients/parse";
import { stripParentheticals } from "../ingredients/normalize";
import type { Vocabulary } from "./vocabulary";

/**
 * Prep notes that are about measuring or serving, not knife work. They are
 * left out of "Other prep" on the prep list, and out of the prep word scan.
 */
export const NOT_PREP_RE =
	/^(?:optional|to taste|plus\b|for\b|packed|divided|at room temperature|room temperature|if desired|as needed|warm|cold|about\b)/i;

/** A piece of prep note that no technique knows, and the recipes that use it. */
export interface PrepPhrase {
	phrase: string;
	recipes: string[];
}

/**
 * Pieces of the prep notes on untagged lines (split at commas, semicolons and
 * "and") that name no technique, most used first: "smashed", "trimmed", "cut into
 * 1-inch pieces". Adding one to a technique's words makes it count as that
 * technique. Measurements and serving notes are left out.
 */
export function unknownPrepPhrases(
	recipes: readonly [title: string, ingredients: ParsedIngredient[]][],
	vocab: Vocabulary,
): PrepPhrase[] {
	const found = new Map<string, Set<string>>();
	for (const [title, ingredients] of recipes) {
		for (const ing of ingredients) {
			// On a tagged line the tags decide the technique and its words are
			// never read, so only untagged lines have words worth adding
			if (vocab.techniquesFor(ing).tagged) continue;
			const note = writtenPrep(ing);
			if (!note) continue;
			for (const raw of stripParentheticals(note).split(/\s*(?:[,;]|\band\b)\s*/i)) {
				const phrase = raw.trim().toLowerCase().replace(/\s+/g, " ");
				if (!phrase || /^\d/.test(phrase) || NOT_PREP_RE.test(phrase)) continue;
				if (vocab.matchWords(phrase).length > 0) continue;
				found.set(phrase, (found.get(phrase) ?? new Set()).add(title));
			}
		}
	}
	return [...found.entries()]
		.map(([phrase, titles]) => ({ phrase, recipes: [...titles].sort() }))
		.sort((a, b) => b.recipes.length - a.recipes.length || a.phrase.localeCompare(b.phrase));
}
