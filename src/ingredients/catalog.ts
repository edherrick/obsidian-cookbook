import type { Ingredient } from "../types";
import { keywordSpans, matchKeyword, UNCATEGORIZED } from "./categorize";
import { normalizeIngredientName } from "./normalize";

/**
 * Plural-insensitive form of a matching key, so "red apples" and "red apple"
 * are one ingredient. Only ever compared, never shown.
 */
export function singularKey(key: string): string {
	return key
		.split(" ")
		.map((w) => {
			if (w.length <= 3 || /(?:ss|us|is)$/.test(w)) return w;
			if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
			if (/(?:sh|ch|x|z|o)es$/.test(w)) return w.slice(0, -2);
			if (w.endsWith("s")) return w.slice(0, -1);
			return w;
		})
		.join(" ");
}

/**
 * Does the text say it's free of a dietary group: "gluten-free", "dairy free",
 * "egg-free" (for Eggs)? The group's name is the word, so no list is needed.
 */
export function saysFreeOf(text: string, group: string): boolean {
	const name = group.trim().toLowerCase();
	if (!name) return false;
	const words = new Set([name, singularKey(name)]);
	return [...words].some((w) => matchKeyword(text, `${w}-free`) || matchKeyword(text, `${w} free`));
}

interface Term {
	text: string;
	ingredient: Ingredient;
}

/**
 * Answers every question about an ingredient line from the ingredient list:
 * which ingredient it is, its category, its dietary groups, whether it's a
 * staple. Built from settings and rebuilt when they change.
 *
 * Three rules, kept apart on purpose:
 * - Same ingredient (merging shopping lines): the whole line must equal a
 *   name or other name. Partial matches never merge, so "blueberries" and
 *   "raspberries" stay two lines even if "berry" is listed.
 * - Category: the longest name that occurs in the line wins ("coconut milk"
 *   beats "milk"); ties go to the earlier category.
 * - Dietary groups and staple: every name that occurs in the line counts,
 *   unless it sits inside a longer one. "butter and almonds" is Dairy and Tree
 *   Nuts; "coconut milk" isn't Dairy. For allergies, missing a group is worse
 *   than an extra one.
 */
export class IngredientCatalog {
	private readonly terms: Term[] = [];
	private readonly byKey = new Map<string, Ingredient>();
	private readonly categoryRank: Map<string, number>;

	constructor(ingredients: readonly Ingredient[], categoryOrder: readonly string[] = []) {
		this.categoryRank = new Map(categoryOrder.map((name, i) => [name, i]));
		for (const ingredient of ingredients) {
			for (const raw of [ingredient.name, ...ingredient.otherNames]) {
				const text = raw.trim();
				if (!text) continue;
				this.terms.push({ text, ingredient });
				const key = singularKey(normalizeIngredientName(text) || text.toLowerCase());
				// First entry wins, so a later duplicate can't silently take over a name
				if (key && !this.byKey.has(key)) this.byKey.set(key, ingredient);
			}
		}
	}

	/** The ingredient a whole line names exactly, by name or other name. */
	exact(text: string): Ingredient | undefined {
		return this.byKey.get(this.key(text));
	}

	/** The name to show and match a line by: its ingredient's name if it names one exactly. */
	canonicalText(text: string): string {
		return this.exact(text)?.name ?? text;
	}

	/** The key two lines must share to be the same ingredient. */
	ingredientKey(text: string): string {
		return this.key(this.canonicalText(text));
	}

	/**
	 * The ingredient a line is mainly about: the one it names exactly, else
	 * the longest name in it ("coconut milk" over "milk"), ties going to the
	 * earlier category.
	 */
	ingredientFor(text: string): Ingredient | undefined {
		const exact = this.exact(text);
		if (exact) return exact;
		const key = normalizeIngredientName(text);
		if (!key) return undefined;

		let best: Term | undefined;
		for (const term of this.terms) {
			if (best && term.text.length < best.text.length) continue;
			if (keywordSpans(key, term.text).length === 0) continue;
			if (!best || term.text.length > best.text.length || this.rank(term) < this.rank(best)) best = term;
		}
		return best?.ingredient;
	}

	/** The category of the line's main ingredient, or Uncategorized. */
	categoryFor(text: string): string {
		return this.ingredientFor(text)?.category || UNCATEGORIZED;
	}

	/**
	 * Dietary groups of every ingredient the line names, except groups the
	 * line says it's free of ("gluten-free flour" isn't Gluten).
	 */
	groupsFor(text: string): Set<string> {
		const groups = new Set<string>();
		for (const ingredient of this.ingredientsIn(text)) {
			for (const g of ingredient.groups) groups.add(g);
		}
		for (const g of groups) {
			if (saysFreeOf(text, g)) groups.delete(g);
		}
		return groups;
	}

	inGroup(text: string, group: string): boolean {
		return this.groupsFor(text).has(group);
	}

	/**
	 * Checked against the line as written as well as its key: the key drops
	 * words like "dried", so "dried thyme" only matches as written.
	 */
	isStaple(text: string): boolean {
		return [...this.ingredientsIn(text), ...this.ingredientsIn(text.toLowerCase(), false)].some((i) => i.staple);
	}

	/**
	 * Every ingredient named in the line, leaving out matches that sit inside
	 * a longer match. A line whose key is exactly one ingredient's name is just
	 * that ingredient. With `normalize` off, the text is searched as given.
	 */
	private ingredientsIn(text: string, normalize = true): Ingredient[] {
		if (normalize) {
			const exact = this.exact(text);
			if (exact) return [exact];
		}
		const line = normalize ? normalizeIngredientName(text) : text;
		if (!line) return [];

		const found: { span: [number, number]; ingredient: Ingredient }[] = [];
		for (const term of this.terms) {
			for (const span of keywordSpans(line, term.text)) found.push({ span, ingredient: term.ingredient });
		}
		const inside = (a: [number, number], b: [number, number]) =>
			b[0] <= a[0] && a[1] <= b[1] && b[1] - b[0] > a[1] - a[0];
		const kept = found.filter((f) => !found.some((g) => inside(f.span, g.span)));
		return [...new Set(kept.map((f) => f.ingredient))];
	}

	private key(text: string): string {
		return singularKey(normalizeIngredientName(text) || text.toLowerCase().trim());
	}

	private rank(term: Term): number {
		return this.categoryRank.get(term.ingredient.category) ?? Number.MAX_SAFE_INTEGER;
	}
}
