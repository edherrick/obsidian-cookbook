import { describe, it, expect } from "vitest";
import { assignCategory, matchesAnyKeyword, matchKeyword } from "./categorize";
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
		["crushed pretzels", "Bakery"],
		["dried oregano", "Pantry"],
		["all purpose flour", "Pantry"],
		["chopped cilantro (optional)", "Produce"],
		["boneless, skinless chicken breasts", "Meat & Fish"],
		["uncooked jasmine rice", "Pantry"],
		["large red onion", "Produce"],
		["vegetable oil", "Pantry"],
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
