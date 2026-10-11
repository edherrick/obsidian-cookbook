import { describe, it, expect } from "vitest";
import { distinctiveIngredients, rankOverlap, unionIngredients } from "./overlap";
import { Vocabulary } from "../vocab/vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";

const options = {
	vocab: new Vocabulary(DEFAULT_SETTINGS),
	categories: DEFAULT_SETTINGS.shoppingCategories,
	ignoreCategories: DEFAULT_SETTINGS.overlapIgnoreCategories,
};

const keysOf = (lines: string[]) => distinctiveIngredients(lines.map(parseIngredient), options);

const burritos = keysOf([
	"2 tsp chili powder",
	"2 tsp kosher salt",
	"2 cups butternut squash | #prep/peel #prep/dice small",
	"olive oil",
	"1 lb ground turkey, 93% lean",
	"3 cups shredded curly kale | packed",
	"12 large eggs",
	"4 oz cheddar cheese | #prep/shred",
]);
const onePan = keysOf([
	"1 tsp smoked paprika",
	"1 1/2 lbs boneless, skinless chicken thighs",
	"1 medium shallot | #prep/mince",
	"1 cup dry jasmine rice | #prep/rinse",
	"2 cups butternut squash | #prep/peel #prep/dice small",
	"2 cups low-sodium chicken or vegetable broth",
	"3 cups shredded curly kale | packed",
]);
const soup = keysOf([
	"1 large red apple | #prep/peel #prep/dice",
	"1 medium shallot | #prep/quarter",
	"5 garlic cloves | #prep/peel",
	"8 oz feta cheese block",
	"1 medium acorn squash | #prep/halve #prep/seed",
]);
const pasta = keysOf(["1 lb penne", "2 Tbsp olive oil", "1 tsp kosher salt", "2 cups chicken broth"]);

describe("distinctiveIngredients", () => {
	it("drops staples and spice/pantry aisles", () => {
		expect([...burritos.keys()]).not.toContain("kosher salt");
		expect([...burritos.keys()]).not.toContain("olive oil");
		expect([...burritos.keys()]).not.toContain("chili powder");
		expect([...burritos.keys()]).toContain("butternut squash");
	});

	it("leaves nothing for a recipe made only of staples and pantry goods", () => {
		expect([...pasta.values()]).toEqual([]);
	});
});

describe("rankOverlap", () => {
	const all = new Map([
		["burritos.md", burritos],
		["one-pan.md", onePan],
		["soup.md", soup],
		["pasta.md", pasta],
	]);

	it("ranks the recipe sharing the most ingredients first", () => {
		const ranked = rankOverlap(burritos, all, new Set(["burritos.md"]));
		expect(ranked[0]!.path).toBe("one-pan.md");
		expect(ranked[0]!.shared.sort()).toEqual(["butternut squash", "curly kale"]);
		expect(ranked.map((r) => r.path)).not.toContain("pasta.md");
	});

	it("scores against a whole set", () => {
		const target = unionIngredients(["burritos.md", "one-pan.md"], all);
		const ranked = rankOverlap(target, all, new Set(["burritos.md", "one-pan.md"]));
		expect(ranked[0]).toMatchObject({ path: "soup.md", shared: ["shallot"] });
	});
});
