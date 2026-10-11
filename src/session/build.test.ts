import { describe, it, expect } from "vitest";
import {
	buildPrepList,
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

	it("groups by technique in prep order", () => {
		const order = ["### Peel", "### Quarter", "### Dice", "### Mince"].map((h) => list.indexOf(h));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
	});

	it("tags each technique heading", () => {
		expect(list).toContain("### Dice #prep/dice");
	});

	it("merges one ingredient across recipes and totals it", () => {
		const dice = list.slice(list.indexOf("### Dice"), list.indexOf("### Mince"));
		expect(dice).toContain("**butternut squash** · 4 cups · small");
		// Cook order is Soup, Burritos, One-Pan, so Burritos is orange, One-Pan yellow
		expect(dice).toContain("— 🟠 2 cups, 🟡 2 cups");
	});

	it("reads untagged prep words too", () => {
		const mince = list.slice(list.indexOf("### Mince"));
		expect(mince).toContain("**garlic**");
		expect(mince).toContain("**medium shallot**");
	});

	it("keeps prep the vocabulary doesn't know, and skips non-prep notes", () => {
		expect(list).toContain("### Other prep");
		expect(list).toContain("**bread**");
		expect(list).not.toContain("curly kale");
	});

	it("lists a recipe once when it uses an ingredient in two steps", () => {
		const skillet = recipe(
			"Skillet.md",
			`- [ ] 1 tsp fresh ginger | #prep/mince\n\nRice.\n\n---\n- [ ] 1 tsp fresh ginger | #prep/mince\n\nSauce.\n`,
		);
		const mince = buildPrepList([skillet], opts);
		expect(mince).toContain("**fresh ginger** · 2 tsp — 🔴");
		const both = buildPrepList([skillet, { ...skillet, path: "Other.md", title: "Other" }], opts);
		expect(both).toContain("**fresh ginger** · 4 tsp — 🔴 2 tsp, 🟠 2 tsp");
	});

	it("scales by the recipe's multiplier", () => {
		const doubled = buildPrepList([{ ...burritos, multiplier: 2 }], opts);
		expect(doubled).toContain("4 cups");
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
		expect(note).toContain("### Oven at 350ºF");
		expect(note).toContain("### Oven at 375ºF");
		expect(note).toContain("**Store:** Freeze for 3 months.");
		// The same dot marks a recipe in the key, its steps, and its storage
		expect(note).toContain("## Recipes\n- 🔴 [[Soup|Soup]]");
		expect(note).toContain("#### 🟠 [[Burritos|Burritos]]");
		expect(note).toContain("### 🟠 Burritos");
		expect(note.trimEnd().endsWith("## My notes")).toBe(true);
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
