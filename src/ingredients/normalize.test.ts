import { describe, it, expect } from "vitest";
import { normalizeIngredientName, stripParentheticals, stripWikilinks } from "./normalize";

describe("stripWikilinks", () => {
	it("unwraps a plain wikilink", () => {
		expect(stripWikilinks("[[Coconut Rice]]")).toBe("Coconut Rice");
	});

	it("keeps the alias of a piped wikilink", () => {
		expect(stripWikilinks("[[Coconut Rice|rice]]")).toBe("rice");
	});

	it("unwraps an embed", () => {
		expect(stripWikilinks("![[cover.png]]")).toBe("cover.png");
	});
});

describe("stripParentheticals", () => {
	it("removes an aside", () => {
		expect(stripParentheticals("garlic (about 12 cloves)").trim()).toBe("garlic");
	});
});

describe("normalizeIngredientName", () => {
	it("drops leading descriptors", () => {
		expect(normalizeIngredientName("shredded Gruyere cheese")).toBe("gruyere cheese");
		expect(normalizeIngredientName("whole milk")).toBe("milk");
		expect(normalizeIngredientName("all purpose flour")).toBe("flour");
	});

	it("never strips the name away entirely", () => {
		expect(normalizeIngredientName("fresh")).toBe("fresh");
	});

	it("truncates at an alternative", () => {
		expect(normalizeIngredientName("Italian sausage or chorizo")).toBe("italian sausage");
	});

	it("truncates at a qualifier so the head noun decides the match", () => {
		// The head of "Pork Sausage with Rosemary" is sausage, not rosemary
		expect(normalizeIngredientName("Pork Sausage with Rosemary and Orange Zest")).toBe(
			"pork sausage",
		);
	});

	it("resolves a wikilinked recipe reference down to its head noun", () => {
		expect(
			normalizeIngredientName(
				"[[Cal-Italian Pork Sausage with Rosemary and Orange Zest]] or 1lb Italian sweet sausage",
			),
		).toBe("cal-italian pork sausage");
	});

	it("drops a size aside", () => {
		expect(normalizeIngredientName("(14-ounce) full-fat coconut milk")).toBe("coconut milk");
	});
});
