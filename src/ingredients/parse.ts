import { canonicalUnit, isCountUnit, isKnownUnit } from "./units";

export interface ParsedIngredient {
	quantity: number | null;
	unit: string | null;
	text: string;
	prep?: string;
	/** Nested tags found on the line, without the `#` — e.g. `prep/dice`. */
	tags?: string[];
}

// ─── Quantity grammar ─────────────────────────────────────────────────────────

/** A single number: mixed ("1 1/2"), fraction ("1/2") or decimal ("1.5"). */
const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;

/**
 * A leading quantity, optionally a range whose upper bound we discard.
 * The lookahead keeps "2x4 pan" style text from being read as a quantity while
 * still allowing a unit glued to the number ("100g") or a size aside ("1 (14-oz)").
 */
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*[-–—]\\s*${NUM})?(?=\\s|[a-zA-Z(]|$)`);

function evalNumber(expr: string): number {
	const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(expr);
	if (mixed) return parseInt(mixed[1]!) + parseInt(mixed[2]!) / parseInt(mixed[3]!);
	const frac = /^(\d+)\/(\d+)$/.exec(expr);
	if (frac) return parseInt(frac[1]!) / parseInt(frac[2]!);
	return parseFloat(expr);
}

// ─── Prep clauses ─────────────────────────────────────────────────────────────

/**
 * A trailing comma clause is only prep when it *starts* with a preparation
 * marker. Without that gate, "boneless, skinless chicken breasts" would lose
 * most of its name, while "4 garlic cloves, chopped" genuinely should split.
 */
const PREP_TAIL_RE =
	/^(?:or\s+)?(?:finely|roughly|coarsely|thinly|thickly|freshly|well|lightly|very)?\s*(?:chopped|diced|minced|sliced|divided|rinsed|drained|softened|melted|grated|shredded|crushed|peeled|halved|quartered|cubed|julienned|trimmed|beaten|cut|torn|seeded|stemmed|zested|juiced|crumbled|mashed|pitted|deveined|scrubbed|washed|warmed|cooled|separated|smashed|sifted|toasted|roasted|browned|thawed|shaved|pressed|chilled|casings|plus|optional|to taste|for serving|for garnish|at room temperature|room temperature|packed|if desired|as needed)\b/i;

/** The first `|` that is not the alias separator inside a `[[wikilink|alias]]`. */
function separatorIndex(raw: string): number {
	let depth = 0;
	for (let i = 0; i < raw.length; i++) {
		if (raw.startsWith("[[", i)) {
			depth++;
			i++;
		} else if (raw.startsWith("]]", i) && depth > 0) {
			depth--;
			i++;
		} else if (raw[i] === "|" && depth === 0) {
			return i;
		}
	}
	return -1;
}

function splitPrep(raw: string): { ingredient: string; prep?: string } {
	// Explicit separator wins: "2 cups flour | sifted"
	const pipeIdx = separatorIndex(raw);
	if (pipeIdx !== -1) {
		return {
			ingredient: raw.slice(0, pipeIdx),
			prep: raw.slice(pipeIdx + 1).trim() || undefined,
		};
	}

	const commaIdx = raw.lastIndexOf(",");
	if (commaIdx !== -1) {
		const tail = raw.slice(commaIdx + 1).trim();
		if (PREP_TAIL_RE.test(tail)) {
			return { ingredient: raw.slice(0, commaIdx), prep: tail || undefined };
		}
	}

	return { ingredient: raw };
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/**
 * Nested tags only (`#prep/dice`). A tag is never part of an ingredient's
 * name, so they are lifted off the line wherever they sit, before anything else
 * reads it. Flat tags are left alone — `#1` is not a tag and `#recipe` is not
 * written on ingredient lines.
 */
const NESTED_TAG_RE = /(?:^|\s)#([A-Za-z][\w-]*(?:\/[\w-]+)+)/g;

function extractTags(raw: string): { rest: string; tags: string[] } {
	const tags: string[] = [];
	const rest = raw.replace(NESTED_TAG_RE, (_m, tag: string) => {
		tags.push(tag);
		return " ";
	});
	return { rest: rest.replace(/\s+/g, " ").trim(), tags };
}

/**
 * Prep as the reader sees it: the techniques the tags named, then whatever
 * else was written. "#prep/peel #prep/dice small" reads "peel, dice · small".
 */
function displayPrep(tags: string[], prep: string | undefined): string | undefined {
	const leaves = tags.map((t) => t.slice(t.lastIndexOf("/") + 1));
	const parts = [leaves.join(", "), prep?.trim() ?? ""].filter((p) => p.length > 0);
	return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** The prep note as written, without the technique names its tags contributed. */
export function writtenPrep(parsed: Pick<ParsedIngredient, "prep" | "tags">): string | undefined {
	if (!parsed.prep) return undefined;
	if (!parsed.tags?.length) return parsed.prep;
	const rest = parsed.prep.split(" · ").slice(1).join(" · ");
	return rest || undefined;
}

// ─── Ingredient parsing ───────────────────────────────────────────────────────

function stripLeadingFiller(s: string): string {
	return s.replace(/^\s*(?:of\s+)/i, "").trim();
}

/**
 * Parse a raw ingredient string into quantity, unit, and name.
 * Handles integers, decimals, fractions (1/2), mixed numbers (1 1/2),
 * ranges of any of those (2-3, 1 1/2 - 2 → lower bound), approximate markers (~),
 * size asides ("1 (14-ounce) can"), and abbreviation periods ("6 Tbsp.").
 * Unit is only extracted if it matches a known cooking unit.
 */
export function parseIngredient(raw: string): ParsedIngredient {
	const { rest: untagged, tags } = extractTags(raw);
	const split = splitPrep(untagged);
	const ingredient = split.ingredient;
	const prep = displayPrep(tags, split.prep);
	const tagged = tags.length > 0 ? { tags } : {};

	// Strip leading approximate marker
	const s = ingredient.replace(/^~\s*/, "").trim();

	const qm = QTY_RE.exec(s);
	if (!qm) return { quantity: null, unit: null, text: s, prep, ...tagged };

	const quantity = evalNumber(qm[1]!);

	// Drop a size aside between the number and the unit: "1 (14-ounce) can …"
	let rest = stripLeadingFiller(s.slice(qm[0].length).replace(/^\s*\([^)]*\)\s*/, " "));

	const words = rest.split(/\s+/).filter(Boolean);
	let unit: string | null = null;
	let textWords = words;

	// Two-word units first ("fl oz"), then one-word
	if (words.length >= 2 && isKnownUnit(`${words[0]} ${words[1]}`)) {
		unit = canonicalUnit(`${words[0]} ${words[1]}`);
		textWords = words.slice(2);
	} else if (words.length >= 1 && isKnownUnit(words[0]!)) {
		unit = canonicalUnit(words[0]!);
		textWords = words.slice(1);
	} else if (words.length >= 2 && isCountUnit(words[words.length - 1]!)) {
		// Trailing count unit: "4 garlic cloves" is 4 cloves of garlic
		unit = canonicalUnit(words[words.length - 1]!);
		textWords = words.slice(0, -1);
	}

	const text = stripLeadingFiller(textWords.join(" "));
	return { quantity, unit, text: text || rest.trim(), prep, ...tagged };
}

// ─── Checkbox parsing ─────────────────────────────────────────────────────────

const CHECKBOX_RE = /^[ \t]*[-*]\s*\[[ xX]?\]\s*(.+)$/gm;

export function parseChecklistItems(text: string): ParsedIngredient[] {
	const re = new RegExp(CHECKBOX_RE.source, CHECKBOX_RE.flags);
	const results: ParsedIngredient[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) results.push(parseIngredient(m[1]!.trim()));
	return results;
}
