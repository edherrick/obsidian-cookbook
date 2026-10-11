import type { SessionRecipe } from "./build";

// ─── Reading recipe notes ───────────────────────────────────────────────────

function stripFrontmatter(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

const STEP_HEADINGS = /^##\s+(?:ingredients|directions|steps|method|instructions)\b/i;

/**
 * The cooking part of a recipe: from its Ingredients heading to the first
 * other level-two heading (Nutrition, Store it, Notes…). The Ingredients and
 * Directions headings themselves are dropped — the session supplies its own.
 */
export function extractSteps(content: string): string {
	const lines = stripFrontmatter(content).split("\n");
	let start = lines.findIndex((l) => STEP_HEADINGS.test(l));
	if (start === -1) start = 0;

	const out: string[] = [];
	for (let i = start; i < lines.length; i++) {
		const line = lines[i]!;
		if (/^##\s/.test(line)) {
			if (STEP_HEADINGS.test(line)) continue;
			break;
		}
		out.push(line);
	}
	return trimRules(out).join("\n");
}

/** Body of one `## Heading` section, or "" when the note has none. */
export function extractSection(content: string, heading: string): string {
	const lines = stripFrontmatter(content).split("\n");
	const want = heading.trim().toLowerCase();
	const start = lines.findIndex((l) => /^##\s/.test(l) && l.slice(2).trim().toLowerCase() === want);
	if (start === -1) return "";
	const out: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		if (/^##?\s/.test(lines[i]!)) break;
		out.push(lines[i]!);
	}
	return trimRules(out).join("\n");
}

/** Drop blank lines and `---` rules from both ends. */
function trimRules(lines: string[]): string[] {
	const isEdge = (l: string) => l.trim() === "" || /^-{3,}\s*$/.test(l);
	let a = 0;
	let b = lines.length;
	while (a < b && isEdge(lines[a]!)) a++;
	while (b > a && isEdge(lines[b - 1]!)) b--;
	return lines.slice(a, b);
}

// ─── Cook order ─────────────────────────────────────────────────────────────

/**
 * Lowest oven first, so the oven only ever heats up between batches; within
 * one temperature, the longest cook goes in first. Stovetop recipes close the
 * session — they fit around whatever is in the oven.
 */
export function cookOrder(recipes: SessionRecipe[]): SessionRecipe[] {
	return [...recipes].sort((a, b) => {
		const ta = a.ovenTemp ?? Infinity;
		const tb = b.ovenTemp ?? Infinity;
		if (ta !== tb) return ta - tb;
		return (b.cookTime ?? 0) - (a.cookTime ?? 0) || a.title.localeCompare(b.title);
	});
}

// ─── Step blocks ────────────────────────────────────────────────────────────

/** One `---` block of a recipe: the ingredients for a step and its directions. */
export interface StepBlock {
	/** `recipes/X.md#2`: the recipe path and the block's 1-based position. */
	ref: string;
	recipePath: string;
	/** 1-based */
	index: number;
	/** How many blocks the recipe has. */
	total: number;
	text: string;
	/** First sentence of the directions, or the ingredients when there are none. */
	summary: string;
}

const RULE_RE = /^-{3,}\s*$/;
const INGREDIENT_RE = /^\s*[-*]\s+\[.\]\s+/;
const LABEL_RE = /^\s*\*\*[^*]+\*\*\s*$/;

function summarize(text: string): string {
	const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
	const prose = lines.find((l) => !INGREDIENT_RE.test(l) && !LABEL_RE.test(l));
	if (prose) {
		const sentence = /^.+?[.!?](?=\s|$)/.exec(prose)?.[0] ?? prose;
		return sentence.length > 140 ? `${sentence.slice(0, 139).trimEnd()}…` : sentence;
	}
	return lines
		.filter((l) => INGREDIENT_RE.test(l))
		.map((l) => l.replace(INGREDIENT_RE, "").split("|")[0]!.trim())
		.join(", ");
}

export function stepRef(recipePath: string, index: number): string {
	return `${recipePath}#${index}`;
}

/** A recipe's steps, split on its `---` rules. Empty blocks are skipped. */
export function splitStepBlocks(recipe: SessionRecipe): StepBlock[] {
	const chunks: string[][] = [[]];
	for (const line of extractSteps(recipe.content).split("\n")) {
		if (RULE_RE.test(line)) chunks.push([]);
		else chunks[chunks.length - 1]!.push(line);
	}
	const texts = chunks.map((c) => c.join("\n").trim()).filter((t) => t.length > 0);
	return texts.map((text, i) => ({
		ref: stepRef(recipe.path, i + 1),
		recipePath: recipe.path,
		index: i + 1,
		total: texts.length,
		text,
		summary: summarize(text),
	}));
}
