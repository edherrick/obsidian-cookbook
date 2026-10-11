import type { IngredientAlias, Technique } from "../types";
import type { ParsedIngredient } from "../ingredients/parse";
import { normalizeIngredientName } from "../ingredients/normalize";
import { matchKeyword } from "../ingredients/categorize";

export interface VocabularyConfig {
	techniqueTagPrefix: string;
	techniques: Technique[];
	ingredientAliases: IngredientAlias[];
	stapleIngredients: string[];
}

export interface TechniqueMatch {
	/** Known techniques, in prep order. */
	techniques: string[];
	/** Tags under the technique prefix that name no known technique. */
	unknown: string[];
	/** Whether the line named its techniques with tags rather than words. */
	tagged: boolean;
}

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
 * What the cookbook knows about names: which ingredient names mean the same
 * thing, which prep words are which technique, and which ingredients are
 * staples. Built from settings and rebuilt whenever they change.
 */
export class Vocabulary {
	readonly prefix: string;
	private readonly techniques: Technique[];
	private readonly canonicalByKey = new Map<string, string>();
	private readonly staples: string[];

	constructor(config: VocabularyConfig) {
		this.prefix = config.techniqueTagPrefix.replace(/^#/, "").replace(/\/+$/, "") || "prep";
		this.techniques = config.techniques.filter((t) => t.name.trim().length > 0);
		this.staples = config.stapleIngredients.map((s) => s.trim()).filter((s) => s.length > 0);

		for (const alias of config.ingredientAliases) {
			const name = alias.name.trim();
			if (!name) continue;
			for (const term of [name, ...alias.keywords]) {
				const key = singularKey(normalizeIngredientName(term));
				// First definition wins, so a later duplicate can't silently re-route a name
				if (key && !this.canonicalByKey.has(key)) this.canonicalByKey.set(key, name);
			}
		}
	}

	/** The name to categorise and display an ingredient by: its alias, else as written. */
	canonicalText(text: string): string {
		const key = singularKey(normalizeIngredientName(text));
		return this.canonicalByKey.get(key) ?? text;
	}

	/** The key two lines must share to be the same ingredient. */
	ingredientKey(text: string): string {
		const canonical = this.canonicalText(text);
		const key = normalizeIngredientName(canonical) || canonical.toLowerCase().trim();
		return singularKey(key);
	}

	/** Checked as written as well as by key: "dried thyme" loses "dried" in its key. */
	isStaple(text: string): boolean {
		const written = text.toLowerCase();
		const key = normalizeIngredientName(this.canonicalText(text));
		return this.staples.some((s) => matchKeyword(written, s) || matchKeyword(key, s));
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
