import { describe, it, expect } from "vitest";
import { assignCategory, matchesAnyKeyword, matchesGroup, matchKeyword } from "./categorize";
import { DEFAULT_SETTINGS } from "../settings/defaults";

const CATEGORIES = DEFAULT_SETTINGS.shoppingCategories;

describe("matchKeyword", () => {
	it("matches a whole word", () => {
		expect(matchKeyword("heavy cream", "cream")).toBe(true);
	});

	it("matches a pluralised ingredient from a singular keyword", () => {
		expect(matchKeyword("crushed pretzels", "pretzel")).toBe(true);
		expect(matchKeyword("roasted potatoes", "potato")).toBe(true);
	});

	it("matches a multi-word keyword", () => {
		expect(matchKeyword("full-fat coconut milk", "coconut milk")).toBe(true);
	});

	it("does NOT match inside a longer word", () => {
		expect(matchKeyword("horseradish cheddar", "radish")).toBe(false);
		expect(matchKeyword("rotini", "tin")).toBe(false);
		expect(matchKeyword("peanut butter", "pea")).toBe(false);
		expect(matchKeyword("graham crackers", "ham")).toBe(false);
		expect(matchKeyword("cornstarch", "corn")).toBe(false);
		expect(matchKeyword("eggplant", "egg")).toBe(false);
	});

	it("ignores an empty keyword", () => {
		expect(matchKeyword("anything", "  ")).toBe(false);
	});
});

describe("assignCategory — specificity", () => {
	const overlap = [
		{ name: "Dairy", keywords: ["milk"] },
		{ name: "Pantry", keywords: ["coconut milk"] },
	];

	it("prefers the longest matching keyword over category order", () => {
		expect(assignCategory("full-fat coconut milk", overlap)).toBe("Pantry");
	});

	it("still uses the generic keyword when nothing more specific matches", () => {
		expect(assignCategory("whole milk", overlap)).toBe("Dairy");
	});

	it("breaks a tie on category order", () => {
		const tie = [
			{ name: "First", keywords: ["cream"] },
			{ name: "Second", keywords: ["cream"] },
		];
		expect(assignCategory("cream", tie)).toBe("First");
	});

	it("matches case-insensitively", () => {
		expect(assignCategory("BUTTER", overlap.concat([{ name: "D", keywords: ["butter"] }]))).toBe("D");
	});

	it("returns Uncategorized when no keyword matches", () => {
		expect(assignCategory("lemon juice", overlap)).toBe("Uncategorized");
	});

	it("returns Uncategorized when the category list is empty", () => {
		expect(assignCategory("milk", [])).toBe("Uncategorized");
	});
});

// Every line here is copied verbatim from a real recipe note and was
// categorised wrongly by the previous first-substring-match-wins matcher.
describe("assignCategory — real recipe lines", () => {
	const cases: [string, string][] = [
		["2 1/2 cups shredded horseradish flavor Cheddar cheese", "Dairy & Eggs"],
		["1 1/2 cups shredded Gruyere cheese", "Dairy & Eggs"],
		["full-fat coconut milk", "Pantry"],
		["2 cups whole milk", "Dairy & Eggs"],
		[
			"[[Cal-Italian Pork Sausage with Rosemary and Orange Zest]] or 1lb Italian sweet sausage",
			"Meat & Fish",
		],
		["Rotini", "Pantry"],
		["horseradish sauce", "Condiments & Sauces"],
		["toothpaste", "Household & Other"],
		["white wine", "Drinks"],
		["sliced prosciutto", "Deli"],
		["crushed pretzels", "Bakery"],
		["dried oregano", "Baking & Spices"],
		["all purpose flour", "Baking & Spices"],
		["chopped cilantro (optional)", "Produce"],
		["boneless, skinless chicken breasts", "Meat & Fish"],
		["uncooked jasmine rice", "Pantry"],
		["large red onion", "Produce"],
		["vegetable oil", "Condiments & Sauces"],
	];

	for (const [text, expected] of cases) {
		it(`puts "${text}" in ${expected}`, () => {
			expect(assignCategory(text, CATEGORIES)).toBe(expected);
		});
	}
});

describe("matchesAnyKeyword", () => {
	it("is true when one keyword matches", () => {
		expect(matchesAnyKeyword("shredded Cheddar cheese", ["milk", "cheese"])).toBe(true);
	});

	it("does not fire on a substring, so dietary filters agree with categories", () => {
		expect(matchesAnyKeyword("horseradish sauce", ["radish"])).toBe(false);
	});

	it("is false for an empty ingredient", () => {
		expect(matchesAnyKeyword("", ["cheese"])).toBe(false);
	});
});

// ─── matchesGroup ─────────────────────────────────────────────────────────────

const GROUPS = DEFAULT_SETTINGS.ingredientGroups;
const group = (name: string) => GROUPS.find((g) => g.name === name)!;

describe("matchesGroup", () => {
	it("behaves like matchesAnyKeyword when a group has no exclusions", () => {
		const plain = { name: "Fish", keywords: ["salmon", "cod"] };
		expect(matchesGroup("wild salmon fillet", plain)).toBe(true);
		expect(matchesGroup("chicken thigh", plain)).toBe(false);
	});

	it("still matches the real thing", () => {
		expect(matchesGroup("2 tbsp butter", group("Dairy"))).toBe(true);
		expect(matchesGroup("whole milk", group("Dairy"))).toBe(true);
		expect(matchesGroup("shredded Gruyere cheese", group("Dairy"))).toBe(true);
		expect(matchesGroup("all purpose flour", group("Gluten"))).toBe(true);
		expect(matchesGroup("dried pasta", group("Gluten"))).toBe(true);
	});

	// Each of these registered as a false positive before exclusions existed
	const notDairy = [
		"full-fat coconut milk",
		"coconut cream",
		"almond milk",
		"oat milk",
		"soy milk",
		"peanut butter",
		"almond butter",
		"cocoa butter",
		"cream of tartar",
	];
	for (const text of notDairy) {
		it(`does not count "${text}" as Dairy`, () => {
			expect(matchesGroup(text, group("Dairy"))).toBe(false);
		});
	}

	const notGluten = ["gluten-free flour", "rice noodles", "almond flour", "buckwheat groats"];
	for (const text of notGluten) {
		it(`does not count "${text}" as Gluten`, () => {
			expect(matchesGroup(text, group("Gluten"))).toBe(false);
		});
	}

	it("keeps eggplant out of Eggs and nutmeg out of Tree Nuts", () => {
		expect(matchesGroup("1 large eggplant", group("Eggs"))).toBe(false);
		expect(matchesGroup("1/4 tsp nutmeg", group("Tree Nuts"))).toBe(false);
	});

	it("separates the shellfish allergen from finfish", () => {
		expect(matchesGroup("king prawns", group("Shellfish"))).toBe(true);
		expect(matchesGroup("king prawns", group("Fish"))).toBe(false);
		expect(matchesGroup("salmon fillet", group("Fish"))).toBe(true);
		expect(matchesGroup("salmon fillet", group("Shellfish"))).toBe(false);
	});

	it("separates peanuts from tree nuts", () => {
		expect(matchesGroup("peanut butter", group("Peanuts"))).toBe(true);
		expect(matchesGroup("peanut butter", group("Tree Nuts"))).toBe(false);
		expect(matchesGroup("ground almonds", group("Tree Nuts"))).toBe(true);
		expect(matchesGroup("ground almonds", group("Peanuts"))).toBe(false);
	});

	it("recognises the soy and sesame groups", () => {
		expect(matchesGroup("2 tbsp soy sauce", group("Soy"))).toBe(true);
		expect(matchesGroup("1 tbsp tahini", group("Sesame"))).toBe(true);
	});
});

describe("assignCategory — aisle keywords must not outrank the ingredient", () => {
	const cases: [string, string][] = [
		// "juice" as a Drinks keyword used to pull citrus out of Produce
		["Juice and zest of 1 lime", "Produce"],
		["2 tbsp lemon juice", "Produce"],
		["1 cup orange juice", "Drinks"],
		// "soda" must not swallow baking soda
		["1 tsp baking soda", "Baking & Spices"],
		["1 can soda", "Drinks"],
		// horseradish is a condiment, but not when it describes a cheese
		["shredded horseradish flavor Cheddar cheese", "Dairy & Eggs"],
		["2 tbsp horseradish sauce", "Condiments & Sauces"],
	];
	for (const [text, expected] of cases) {
		it(`puts "${text}" in ${expected}`, () => {
			expect(assignCategory(text, CATEGORIES)).toBe(expected);
		});
	}
});
