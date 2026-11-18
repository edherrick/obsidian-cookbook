import { describe, it, expect } from "vitest";
import {
	buildPrepList,
	prepName,
	buildSessionNote,
	cookOrder,
	extractSection,
	extractSteps,
	keptNotes,
} from "./build";
import type { SessionRecipe } from "./build";
import { Vocabulary } from "../vocab/vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseChecklistItems } from "../ingredients/parse";

const vocab = new Vocabulary(DEFAULT_SETTINGS);
const opts = { vocab, date: "2026-10-11" };

function recipe(path: string, body: string, extra: Partial<SessionRecipe> = {}): SessionRecipe {
	const content = `---\ntags:\n  - recipe\n---\n${body}`;
	return {
		path,
		title: path.replace(/\.md$/, ""),
		content,
		ingredients: parseChecklistItems(content),
		...extra,
	};
}

const burritos = recipe(
	"Burritos.md",
	`![](cover)

---
## Ingredients
- [ ] 2 cups butternut squash | #prep/peel #prep/dice small
- [ ] 3 cups shredded curly kale | packed

## Directions
Roast the squash.

---

- [ ] 12 large eggs

Scramble the eggs.

---
## Nutrition
200 cal

## Store it
Freeze for 3 months.

## Reheat it
Microwave 2 minutes.
`,
	{ ovenTemp: 350, cookTime: 30, equipment: ["Sheet pan", "Large skillet"] },
);

const onePan = recipe(
	"One-Pan.md",
	`## Ingredients
- [ ] 2 cups butternut squash | #prep/peel #prep/dice small (1/4-inch)
- [ ] 1 medium shallot | #prep/mince
- [ ] 3 garlic cloves, minced

## Directions
Cook it all.
`,
	{ ovenTemp: 375, cookTime: 45, equipment: ["sheet pan", "Oven-safe skillet"] },
);

const soup = recipe(
	"Soup.md",
	`## Ingredients
- [ ] 1 medium shallot | #prep/quarter
- [ ] 5 garlic cloves | #prep/peel
- [ ] 1 cup bread | toasted

## Directions
Blend.
`,
	{ ovenTemp: 350, cookTime: 45 },
);

describe("extractSteps", () => {
	it("keeps the step blocks and drops the cover, headings and trailing sections", () => {
		const steps = extractSteps(burritos.content);
		expect(steps).toContain("- [ ] 2 cups butternut squash");
		expect(steps).toContain("Scramble the eggs.");
		expect(steps).not.toContain("## Ingredients");
		expect(steps).not.toContain("## Directions");
		expect(steps).not.toContain("![](cover)");
		expect(steps).not.toContain("200 cal");
		expect(steps.endsWith("Scramble the eggs.")).toBe(true);
	});
});

describe("extractSection", () => {
	it("reads one section up to the next heading", () => {
		expect(extractSection(burritos.content, "Store it")).toBe("Freeze for 3 months.");
		expect(extractSection(burritos.content, "reheat it")).toBe("Microwave 2 minutes.");
		expect(extractSection(burritos.content, "Swaps & subs")).toBe("");
	});
});

describe("buildPrepList", () => {
	const list = buildPrepList([burritos, onePan, soup], opts);
	const lines = list.split("\n");
	const lineFor = (name: string) => lines.filter((l) => l.includes(`**${name}**`));

	it("has no technique headings", () => {
		expect(list).not.toContain("###");
	});

	it("puts every step for an ingredient on one line, in prep order", () => {
		const squash = lineFor("butternut squash");
		expect(squash).toHaveLength(1);
		expect(squash[0]).toContain("· peel, dice ·");
	});

	it("merges an ingredient prepped the same way across recipes and totals it", () => {
		// Cook order is Soup, Burritos, One-Pan, so Burritos is orange, One-Pan yellow
		expect(lineFor("butternut squash")[0]).toContain("**butternut squash** · 4 cups · peel, dice · small");
		expect(lineFor("butternut squash")[0]).toContain("— 🟠 Burritos 2 cups, 🟡 One-Pan 2 cups");
	});

	it("gives different prep its own line, beside the ingredient's other lines", () => {
		const garlic = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes("**garlic**"));
		expect(garlic.map(([l]) => l)).toEqual([
			"- [ ] **garlic** · 5 cloves · peel — 🔴 Soup",
			"- [ ] **garlic** · 3 cloves · mince · minced — 🟡 One-Pan",
		]);
		expect(garlic[1]![1] - garlic[0]![1]).toBe(1);
	});

	it("runs ingredients in the order of their first step, unknown prep last", () => {
		const at = (name: string) => lines.findIndex((l) => l.includes(`**${name}**`));
		expect(at("butternut squash")).toBeLessThan(at("medium shallot"));
		expect(lines[lines.length - 1]).toContain("**bread**");
	});

	it("reads untagged prep words too", () => {
		expect(lineFor("medium shallot").some((l) => l.includes("· mince"))).toBe(true);
	});

	it("keeps prep the vocabulary doesn't know, and skips non-prep notes", () => {
		expect(list).toContain("**bread** · 1 cup · toasted — 🔴 Soup");
		expect(list).not.toContain("curly kale");
	});

	it("lists a recipe once when it uses an ingredient in two steps", () => {
		const skillet = recipe(
			"Skillet.md",
			`- [ ] 1 tsp fresh ginger | #prep/mince\n\nRice.\n\n---\n- [ ] 1 tsp fresh ginger | #prep/mince\n\nSauce.\n`,
		);
		const mince = buildPrepList([skillet], opts);
		expect(mince).toContain("**fresh ginger** · 2 tsp · mince — 🔴 Skillet");
		const both = buildPrepList([skillet, { ...skillet, path: "Other.md", title: "Other" }], opts);
		expect(both).toContain("**fresh ginger** · 4 tsp · mince — 🔴 Other 2 tsp, 🟠 Skillet 2 tsp");
	});

	it("leaves out an untagged line whose note was marked as not prep", () => {
		const skillet = recipe("Skillet.md", "- [ ] 1 1/2 tbsp taco seasoning | half of a 1-oz packet\n- [ ] 1 lb sausage | casings removed");
		const ignoring = { ...opts, vocab: new Vocabulary({ ...DEFAULT_SETTINGS, ignoredPrepPhrases: ["half of a 1-oz packet"] }) };
		expect(buildPrepList([skillet], opts)).toContain("**taco seasoning**");
		const out = buildPrepList([skillet], ignoring);
		expect(out).not.toContain("taco seasoning");
		expect(out).toContain("**sausage** · 1 lb · casings removed");
	});

	it("keeps a linked ingredient's link whole", () => {
		const pasta = recipe("Pasta.md", "- [ ] 1 lb [[House Sausage]] (or Italian sausage) | #prep/peel");
		expect(buildPrepList([pasta], opts)).toContain("**[[House Sausage]]** · 1 lb · peel");
	});

	it("scales by the recipe's multiplier", () => {
		const doubled = buildPrepList([{ ...burritos, multiplier: 2 }], opts);
		expect(doubled).toContain("4 cups");
	});
});

describe("prepName", () => {
	it("uses the first alias, else the full title", () => {
		expect(prepName({ title: "Turkey and Black Bean Taco Skillet" })).toBe("Turkey and Black Bean Taco Skillet");
		expect(prepName({ title: "Turkey and Black Bean Taco Skillet", aliases: ["Taco skillet", "Tacos"] })).toBe("Taco skillet");
		expect(prepName({ title: "Soup", aliases: ["  "] })).toBe("Soup");
	});

	it("names the recipe by its alias on the prep list", () => {
		const list = buildPrepList([{ ...soup, aliases: ["Squash soup"] }], opts);
		expect(list).toContain("— 🔴 Squash soup");
	});
});

describe("cookOrder", () => {
	it("goes lowest oven first, longest cook first within a temperature, stovetop last", () => {
		const stovetop = recipe("Stir-fry.md", "", { cookTime: 20 });
		expect(cookOrder([stovetop, onePan, burritos, soup]).map((r) => r.title)).toEqual([
			"Soup",
			"Burritos",
			"One-Pan",
			"Stir-fry",
		]);
	});
});

describe("buildSessionNote", () => {
	it("writes every section", () => {
		const note = buildSessionNote([burritos, onePan, soup], opts);
		expect(note.startsWith("---\ntags:\n  - cook-session\ndate: 2026-10-11\n")).toBe(true);
		expect(note).toContain('  - "[[Soup|Soup]]"');
		expect(note).toContain("## Equipment\n- [ ] Sheet pan\n- [ ] Large skillet\n- [ ] Oven-safe skillet");
		expect(note).toContain('cook-plan:\n  - "Soup.md#1"\n  - "Burritos.md#1"\n  - "Burritos.md#2"\n  - "One-Pan.md#1"');
		expect(note).toContain("**Store:** Freeze for 3 months.");
		// The same dot marks a recipe in the key, its steps, and its storage
		expect(note).toContain("## Recipes\n- 🔴 [[Soup|Soup]]");
		expect(note).toContain("### 2. 🟠 [[Burritos|Burritos]] · oven 350ºF");
		expect(note).toContain("### 🟠 Burritos");
		expect(note.trimEnd().endsWith("## My notes")).toBe(true);
	});

	it("numbers the default cook order and shows oven and timing once per recipe", () => {
		const note = buildSessionNote([burritos, onePan, soup], opts);
		expect(note).toContain("### 1. 🔴 [[Soup|Soup]] · oven 350ºF\n_step 1 of 1 · cook 45 min_");
		expect(note).toContain("### 3. 🟠 [[Burritos|Burritos]]\n_step 2 of 2_\n\n- [ ] 12 large eggs");
		expect(note).toContain("### 4. 🟡 [[One-Pan|One-Pan]] · oven 375ºF");
	});

	it("follows a saved plan, with meanwhile steps under the step before", () => {
		const plan = [
			{ ref: "Burritos.md#1", meanwhile: false },
			{ ref: "Soup.md#1", meanwhile: true },
			{ ref: "Burritos.md#2", meanwhile: false },
		];
		const note = buildSessionNote([burritos, onePan, soup], { ...opts, plan });
		const order = note.slice(note.indexOf("## Cook order"));
		expect(order).toContain("### 1. 🟠 [[Burritos|Burritos]] · oven 350ºF");
		expect(order).toContain("#### ↳ Meanwhile: 🔴 [[Soup|Soup]] · oven 350ºF");
		expect(order).toContain("### 2. 🟠 [[Burritos|Burritos]]\n_step 2 of 2_");
		// One-Pan was not in the plan, so it is appended
		expect(order).toContain("### 3. 🟡 [[One-Pan|One-Pan]]");
		expect(note).toContain('  - "meanwhile Soup.md#1"');
	});

	it("links to the arrange modal when given a link", () => {
		const note = buildSessionNote([soup], { ...opts, arrangeLink: "obsidian://cookbook-arrange?file=x" });
		expect(note).toContain("> [Arrange the cook order](obsidian://cookbook-arrange?file=x)");
	});

	it("keeps My notes when regenerated", () => {
		const first = buildSessionNote([burritos], opts);
		const edited = `${first}Start the oats first!\n`;
		const second = buildSessionNote([burritos, soup], { ...opts, existingContent: edited });
		expect(second).toContain("Start the oats first!");
		expect(second).toContain("[[Soup|Soup]]");
		expect(second.match(/## My notes/g)).toHaveLength(1);
	});
});

describe("keptNotes", () => {
	it("starts an empty section for a new note", () => {
		expect(keptNotes(undefined)).toBe("## My notes\n");
		expect(keptNotes("# Something else")).toBe("## My notes\n");
	});
});
