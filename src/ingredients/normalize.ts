/**
 * Ingredient name normalisation.
 *
 * These helpers produce a *matching key* — used for categorisation and for
 * deciding whether two shopping list lines are the same ingredient. The text
 * the user sees is never changed by this; display text stays exactly as written
 * in the recipe note.
 */

/** `[[Note]]` → `Note`, `[[Note|Alias]]` → `Alias`, `![[Note]]` → `Note`. */
export function stripWikilinks(s: string): string {
	return s.replace(/!?\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
		const pipe = inner.lastIndexOf("|");
		return pipe === -1 ? inner : inner.slice(pipe + 1);
	});
}

/** Drop parenthetical asides: "(about 12 cloves)", "(optional)", "(14-ounce)". */
export function stripParentheticals(s: string): string {
	return s.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
}

/**
 * Words that qualify an ingredient without changing what it is. Stripped from
 * the *front* of the matching key so "shredded cheddar cheese" and "cheddar
 * cheese" match the same keywords.
 */
const LEADING_DESCRIPTORS = new Set([
	"shredded", "chopped", "minced", "sliced", "diced", "grated", "crushed",
	"ground", "fresh", "freshly", "dried", "frozen", "canned", "tinned",
	"large", "medium", "small", "whole", "half", "boneless", "skinless",
	"uncooked", "cooked", "raw", "ripe", "extra", "finely", "coarsely",
	"roughly", "thinly", "thickly", "full-fat", "low-fat", "reduced-fat",
	"nonfat", "unsalted", "salted", "all", "purpose", "all-purpose", "plain",
	"packed", "heaping", "level", "softened", "melted", "divided", "peeled",
	"trimmed", "rinsed", "drained", "beaten", "good", "quality", "organic",
	"of", "a", "an", "the",
]);

/**
 * Phrases that introduce material which is not part of the ingredient's name —
 * an alternative, a garnish, an accompaniment. Everything from the first such
 * phrase onward is dropped, because English ingredient names put the head noun
 * before them ("pork sausage with rosemary" is a sausage, not a herb).
 */
const TRUNCATE_AT = [" or ", " with ", " plus ", " for serving", " to serve"];

/**
 * Reduce an ingredient name to a stable key for keyword matching and merging.
 */
export function normalizeIngredientName(text: string): string {
	let s = stripParentheticals(stripWikilinks(text)).toLowerCase();

	for (const marker of TRUNCATE_AT) {
		const idx = s.indexOf(marker);
		if (idx > 0) s = s.slice(0, idx);
	}

	// Collapse whitespace and shed surrounding punctuation
	s = s.replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "").trim();

	// Peel leading descriptors, but never strip the whole name away
	const words = s.split(" ");
	let start = 0;
	while (start < words.length - 1 && LEADING_DESCRIPTORS.has(words[start]!)) start++;

	return words.slice(start).join(" ").trim();
}
