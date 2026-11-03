import type { Ingredient, ShoppingCategory, Technique } from "../types";
import type { ParsedIngredient } from "../ingredients/parse";
import { matchKeyword } from "../ingredients/categorize";
import { IngredientCatalog, singularKey } from "../ingredients/catalog";

export interface VocabularyConfig {
	techniqueTagPrefix: string;
	techniques: Technique[];
	ingredients: Ingredient[];
	/** Their order breaks ties when two ingredients in a line are equally specific. */
	shoppingCategories: ShoppingCategory[];
}

export interface TechniqueMatch {
	/** Known techniques, in prep order. */
	techniques: string[];
	/** Tags under the technique prefix that name no known technique. */
	unknown: string[];
	/** Whether the line named its techniques with tags rather than words. */
	tagged: boolean;
}

export { singularKey };

/**
 * What the cookbook knows about names: the ingredient list (which names are
 * one ingredient, its category, dietary groups, staples) and which prep words
 * are which technique. Built from settings and rebuilt whenever they change.
 */
export class Vocabulary {
	readonly prefix: string;
	readonly catalog: IngredientCatalog;
	private readonly techniques: Technique[];

	constructor(config: VocabularyConfig) {
		this.prefix = config.techniqueTagPrefix.replace(/^#/, "").replace(/\/+$/, "") || "prep";
		this.techniques = config.techniques.filter((t) => t.name.trim().length > 0);
		this.catalog = new IngredientCatalog(
			config.ingredients,
			config.shoppingCategories.map((c) => c.name),
		);
	}

	/** The name to categorise and display an ingredient by: its listed name, else as written. */
	canonicalText(text: string): string {
		return this.catalog.canonicalText(text);
	}

	/** The key two lines must share to be the same ingredient. */
	ingredientKey(text: string): string {
		return this.catalog.ingredientKey(text);
	}

	/** The shopping category for a line, or Uncategorized. */
	categoryFor(text: string): string {
		return this.catalog.categoryFor(text);
	}

	inGroup(text: string, group: string): boolean {
		return this.catalog.inGroup(text, group);
	}

	isStaple(text: string): boolean {
		return this.catalog.isStaple(text);
	}

	/** Technique names in list (prep) order. */
	techniqueNames(): string[] {
		return this.techniques.map((t) => t.name);
	}

	tagFor(technique: string): string {
		return `#${this.prefix}/${technique}`;
	}

	/**
	 * Techniques an ingredient line calls for. Tags are authoritative; a line
	 * without them falls back to matching its prep words against keywords.
	 */
	techniquesFor(parsed: Pick<ParsedIngredient, "prep" | "tags">): TechniqueMatch {
		const ownTags = (parsed.tags ?? [])
			.filter((t) => t.toLowerCase().startsWith(`${this.prefix.toLowerCase()}/`))
			.map((t) => t.slice(this.prefix.length + 1).toLowerCase());

		if (ownTags.length > 0) {
			const found = new Set<string>();
			const unknown: string[] = [];
			for (const tag of ownTags) {
				const technique = this.techniques.find((t) => t.name.toLowerCase() === tag);
				if (technique) found.add(technique.name);
				else unknown.push(tag);
			}
			return { techniques: this.inOrder(found), unknown, tagged: true };
		}

		return { techniques: this.matchWords(parsed.prep ?? ""), unknown: [], tagged: false };
	}

	/** Techniques whose name or keywords occur in free text. */
	matchWords(text: string): string[] {
		if (!text.trim()) return [];
		const found = new Set<string>();
		for (const t of this.techniques) {
			if ([t.name, ...t.keywords].some((kw) => matchKeyword(text, kw))) found.add(t.name);
		}
		return this.inOrder(found);
	}

	private inOrder(names: Set<string>): string[] {
		return this.techniques.map((t) => t.name).filter((n) => names.has(n));
	}
}
