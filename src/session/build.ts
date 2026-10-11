import type { ParsedIngredient } from "../ingredients/parse";
import { writtenPrep } from "../ingredients/parse";
import type { ShoppingItem } from "../types";
import type { Vocabulary } from "../vocab/vocabulary";
import { aggregateItems } from "../ingredients/aggregate";
import type { DisplayUnitPrefs } from "../ingredients/aggregate";
import { formatQty, roundQty } from "../ingredients/units";
import { stripParentheticals } from "../ingredients/normalize";
import { cookOrder, extractSection } from "./steps";
import { planSteps, serializePlan, toPlan } from "./plan";
import type { PlanEntry, PlannedStep } from "./plan";

export { cookOrder, extractSection, extractSteps } from "./steps";

/** One recipe going into a cook session. */
export interface SessionRecipe {
	path: string;
	title: string;
	/** The note's raw markdown, frontmatter included. */
	content: string;
	ingredients: ParsedIngredient[];
	multiplier?: number;
	ovenTemp?: number;
	prepTime?: number;
	cookTime?: number;
	servings?: string;
	equipment?: string[];
	fridgeDays?: number;
	freezerMonths?: number;
}

export interface SessionOptions {
	vocab: Vocabulary;
	/** YYYY-MM-DD */
	date: string;
	unitPrefs?: DisplayUnitPrefs;
	/** The note being regenerated, if any — its "My notes" section is kept. */
	existingContent?: string;
	/** How to link a recipe; defaults to a path wikilink aliased to the title. */
	linkTo?: (r: SessionRecipe) => string;
	/** A hand-arranged cook order; without one, recipes run one after another. */
	plan?: PlanEntry[];
	/** A link that opens the arrange-steps modal for this note. */
	arrangeLink?: string;
}

export const MY_NOTES_HEADING = "## My notes";

/**
 * Prep notes that are about measuring or serving, not knife work. They are
 * left out of "Other prep", which is for prep the vocabulary doesn't know yet.
 */
const NOT_PREP_RE =
	/^(?:optional|to taste|plus\b|for serving|for garnish|for topping|packed|divided|at room temperature|room temperature|if desired|as needed|warm|cold|about\b)/i;

/** Everything from the "My notes" heading on, so a regenerate keeps it. */
export function keptNotes(existing: string | undefined): string {
	if (!existing) return `${MY_NOTES_HEADING}\n`;
	const idx = existing.search(/^## My notes\s*$/m);
	return idx === -1 ? `${MY_NOTES_HEADING}\n` : existing.slice(idx);
}

// ─── Recipe colors ──────────────────────────────────────────────────────────

/** Plain emoji, so the colors show in every view and on mobile with no CSS. */
const RECIPE_DOTS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪"];

/**
 * One colored dot per recipe, assigned in cook order so the key at the top
 * reads in rainbow order. Past nine recipes the colors repeat.
 */
export function recipeDots(recipes: SessionRecipe[]): Map<string, string> {
	return new Map(cookOrder(recipes).map((r, i) => [r.path, RECIPE_DOTS[i % RECIPE_DOTS.length]!]));
}

// ─── Prep list ──────────────────────────────────────────────────────────────

interface PrepEntry {
	item: ShoppingItem;
	recipe: SessionRecipe;
	detail?: string;
}

function toItem(ing: ParsedIngredient, recipe: SessionRecipe): ShoppingItem {
	const m = recipe.multiplier ?? 1;
	return {
		id: "",
		text: ing.text,
		quantity: ing.quantity !== null ? roundQty(ing.quantity * m) : null,
		unit: ing.unit,
		checked: false,
		category: "",
		source: "recipe",
		recipeTitle: recipe.title,
	};
}

/** Asides like "(about half a large squash)" are for the shop, not the board. */
function tidy(s: string): string {
	return stripParentheticals(s)
		.replace(/\s+([,;])/g, "$1")
		.replace(/\s+/g, " ")
		.replace(/^[\s,;]+|[\s,;]+$/g, "");
}

function amount(item: Pick<ShoppingItem, "quantity" | "unit">): string {
	if (item.quantity === null) return "";
	return item.unit ? `${formatQty(item.quantity)} ${item.unit}` : formatQty(item.quantity);
}

function prepLine(entries: PrepEntry[], opts: SessionOptions, dots: Map<string, string>): string {
	const keyOf = (t: string) => opts.vocab.ingredientKey(t);
	const totals = aggregateItems(
		entries.map((e) => e.item),
		opts.unitPrefs,
		keyOf,
	)
		.map(amount)
		.filter(Boolean);
	const details = [
		...new Set(entries.map((e) => (e.detail ? tidy(e.detail) : "")).filter((d) => d.length > 0)),
	];
	// A recipe that uses the ingredient in two steps is still one source
	const byRecipe = new Map<string, PrepEntry[]>();
	for (const e of entries) byRecipe.set(e.recipe.path, [...(byRecipe.get(e.recipe.path) ?? []), e]);
	// In key order, so the dots read the same way on every line
	const rank = [...dots.keys()];
	const groups = [...byRecipe.values()].sort(
		(x, y) => rank.indexOf(x[0]!.recipe.path) - rank.indexOf(y[0]!.recipe.path),
	);
	const sources = groups.map((group) => {
		const a = aggregateItems(
			group.map((e) => e.item),
			opts.unitPrefs,
			keyOf,
		)
			.map(amount)
			.filter(Boolean)
			.join(" + ");
		return { dot: dots.get(group[0]!.recipe.path) ?? "", amount: a };
	});

	const name = tidy(entries[0]!.item.text) || entries[0]!.item.text;
	const head = [`**${name}**`, totals.join(" + "), details.join("; ")]
		.filter(Boolean)
		.join(" · ");
	// One source needs no amount when it is the whole total
	const tail =
		sources.length > 1
			? sources.map((x) => (x.amount ? `${x.dot} ${x.amount}` : x.dot)).join(", ")
			: sources[0]!.dot;
	return `- [ ] ${head} — ${tail}`;
}

function groupByIngredient(entries: PrepEntry[], vocab: Vocabulary): PrepEntry[][] {
	const groups = new Map<string, PrepEntry[]>();
	for (const e of entries) {
		const key = vocab.ingredientKey(e.item.text);
		const list = groups.get(key) ?? [];
		list.push(e);
		groups.set(key, list);
	}
	return [...groups.values()];
}

/**
 * The combined prep list: one section per technique, in prep order, so all
 * the peeling happens before all the dicing. An ingredient that is peeled and
 * diced appears under both — those are two passes over the board.
 */
export function buildPrepList(recipes: SessionRecipe[], opts: SessionOptions): string {
	const dots = recipeDots(recipes);
	const byTechnique = new Map<string, PrepEntry[]>();
	const other: PrepEntry[] = [];

	for (const recipe of recipes) {
		for (const ing of recipe.ingredients) {
			const { techniques } = opts.vocab.techniquesFor(ing);
			const detail = writtenPrep(ing);
			const entry = { item: toItem(ing, recipe), recipe, detail };
			if (techniques.length === 0) {
				if (detail && !NOT_PREP_RE.test(detail)) other.push(entry);
				continue;
			}
			for (const t of techniques) {
				const list = byTechnique.get(t) ?? [];
				list.push(entry);
				byTechnique.set(t, list);
			}
		}
	}

	const sections: string[] = [];
	for (const t of opts.vocab.techniqueNames()) {
		const entries = byTechnique.get(t);
		if (!entries) continue;
		const title = t.charAt(0).toUpperCase() + t.slice(1);
		const lines = groupByIngredient(entries, opts.vocab).map((g) => prepLine(g, opts, dots));
		sections.push(`### ${title} ${opts.vocab.tagFor(t)}\n${lines.join("\n")}`);
	}
	if (other.length > 0) {
		const lines = groupByIngredient(other, opts.vocab).map((g) => prepLine(g, opts, dots));
		sections.push(`### Other prep\n${lines.join("\n")}`);
	}
	return sections.length > 0 ? sections.join("\n\n") : "_Nothing to prep ahead._";
}

// ─── Cook order ─────────────────────────────────────────────────────────────

function timing(r: SessionRecipe): string {
	return [
		r.prepTime ? `prep ${r.prepTime} min` : "",
		r.cookTime ? `cook ${r.cookTime} min` : "",
		r.servings ? `serves ${r.servings}` : "",
		(r.multiplier ?? 1) !== 1 ? `×${r.multiplier}` : "",
	]
		.filter(Boolean)
		.join(" · ");
}

function storage(r: SessionRecipe): string {
	return [
		r.fridgeDays ? `fridge ${r.fridgeDays} days` : "",
		r.freezerMonths ? `freezer ${r.freezerMonths} months` : "",
	]
		.filter(Boolean)
		.join(" · ");
}

/**
 * The plan as a numbered list of main steps, each followed by whatever is done
 * meanwhile. A recipe's first appearance carries its oven temperature and
 * timings, so preheating and the overall timing stay visible.
 */
export function renderCookOrder(
	planned: PlannedStep[],
	link: (r: SessionRecipe) => string,
	dot: (r: SessionRecipe) => string,
): string {
	if (planned.length === 0) return "_No steps found._";
	const introduced = new Set<string>();
	let n = 0;
	return planned
		.map(({ block, recipe, meanwhile }) => {
			const first = !introduced.has(recipe.path);
			introduced.add(recipe.path);
			const oven = first && recipe.ovenTemp ? ` · oven ${recipe.ovenTemp}ºF` : "";
			const heading = meanwhile
				? `#### ↳ Meanwhile: ${dot(recipe)} ${link(recipe)}${oven}`
				: `### ${++n}. ${dot(recipe)} ${link(recipe)}${oven}`;
			const t = first ? timing(recipe) : "";
			const meta = [`step ${block.index} of ${block.total}`, t].filter(Boolean).join(" · ");
			return `${heading}\n_${meta}_\n\n${block.text}`;
		})
		.join("\n\n");
}

// ─── The note ───────────────────────────────────────────────────────────────

function defaultLink(r: SessionRecipe): string {
	return `[[${r.path.replace(/\.md$/, "")}|${r.title}]]`;
}

function yamlString(s: string): string {
	return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildSessionNote(recipes: SessionRecipe[], opts: SessionOptions): string {
	const link = opts.linkTo ?? defaultLink;
	const ordered = cookOrder(recipes);
	const dots = recipeDots(recipes);
	const dot = (r: SessionRecipe) => dots.get(r.path) ?? "";
	const planned = planSteps(recipes, opts.plan);

	const frontmatter = [
		"---",
		"tags:",
		"  - cook-session",
		`date: ${opts.date}`,
		"recipes:",
		...ordered.map((r) => `  - ${yamlString(link(r))}`),
		"cook-plan:",
		...serializePlan(toPlan(planned)).map((e) => `  - ${yamlString(e)}`),
		"---",
	].join("\n");

	const recipeList = ordered
		.map((r) => {
			const meta = [timing(r), storage(r)].filter(Boolean).join(" · ");
			return `- ${dot(r)} ${link(r)}${meta ? ` — ${meta}` : ""}`;
		})
		.join("\n");

	const seen = new Set<string>();
	const equipment: string[] = [];
	for (const r of ordered) {
		for (const e of r.equipment ?? []) {
			// "small bowl (2)" and "small bowl" are the same thing to fetch
			const k = tidy(e).toLowerCase();
			if (k && !seen.has(k)) {
				seen.add(k);
				equipment.push(e.trim());
			}
		}
	}


	const storeReheat = ordered
		.map((r) => {
			const store = extractSection(r.content, "Store it");
			const reheat = extractSection(r.content, "Reheat it");
			if (!store && !reheat) return "";
			return [
				`### ${dot(r)} ${r.title}`,
				store ? `**Store:** ${store}` : "",
				reheat ? `**Reheat:** ${reheat}` : "",
			]
				.filter(Boolean)
				.join("\n\n");
		})
		.filter(Boolean)
		.join("\n\n");

	return [
		frontmatter,
		`# Cook session ${opts.date}`,
		[
			"> [!info] Generated by Cookbook",
			"> Everything above **My notes** is rewritten when this session is regenerated.",
			opts.arrangeLink ? `> [Arrange the cook order](${opts.arrangeLink})` : "",
		]
			.filter(Boolean)
			.join("\n"),
		`## Recipes\n${recipeList}`,
		equipment.length > 0 ? `## Equipment\n${equipment.map((e) => `- [ ] ${e}`).join("\n")}` : "",
		`## Prep list\n${buildPrepList(ordered, opts)}`,
		`## Cook order\n${renderCookOrder(planned, link, dot)}`,
		storeReheat ? `## Store and reheat\n${storeReheat}` : "",
		keptNotes(opts.existingContent).trimEnd(),
	]
		.filter(Boolean)
		.join("\n\n")
		.concat("\n");
}
