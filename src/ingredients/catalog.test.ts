import { describe, it, expect } from "vitest";
import { IngredientCatalog, saysFreeOf } from "./catalog";
import type { Ingredient } from "../types";

const ing = (name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
	name,
	otherNames: [],
	category: "",
	groups: [],
	...extra,
});

const catalog = new IngredientCatalog(
	[
		ing("butter", { category: "Dairy & Eggs", groups: ["Dairy"], staple: true }),
		ing("milk", { category: "Dairy & Eggs", groups: ["Dairy"] }),
		ing("coconut milk", { category: "Pantry" }),
		ing("almond", { category: "Pantry", groups: ["Tree Nuts"] }),
		ing("berry", { category: "Produce" }),
		ing("scallion", { otherNames: ["green onion", "spring onion"], category: "Produce" }),
		ing("salt", { category: "Baking & Spices", staple: true }),
		ing("flour", { category: "Baking & Spices", groups: ["Gluten"] }),
		ing("lemon", { category: "Produce" }),
		ing("juice", { category: "Drinks" }),
	],
	["Produce", "Dairy & Eggs", "Pantry", "Baking & Spices", "Drinks"],
);

describe("IngredientCatalog — same ingredient", () => {
	it("treats another name as the ingredient", () => {
		expect(catalog.canonicalText("green onions")).toBe("scallion");
		expect(catalog.ingredientKey("spring onion")).toBe(catalog.ingredientKey("scallions"));
	});

	it("never merges lines on a partial match", () => {
		expect(catalog.ingredientKey("blueberries")).not.toBe(catalog.ingredientKey("raspberries"));
		expect(catalog.canonicalText("blueberries")).toBe("blueberries");
	});

	it("is plural-insensitive", () => {
		expect(catalog.ingredientKey("red apples")).toBe(catalog.ingredientKey("red apple"));
	});
});

describe("IngredientCatalog — category", () => {
	it("prefers the longest name in the line", () => {
		expect(catalog.categoryFor("full-fat coconut milk")).toBe("Pantry");
		expect(catalog.categoryFor("2 cups whole milk")).toBe("Dairy & Eggs");
	});

	it("files an ingredient by a word inside the line", () => {
		expect(catalog.categoryFor("fresh blueberries")).toBe("Uncategorized");
		expect(catalog.categoryFor("berry compote")).toBe("Produce");
	});

	it("breaks a tie on category order", () => {
		expect(catalog.categoryFor("lemon juice")).toBe("Produce");
	});

	it("uses another name's ingredient", () => {
		expect(catalog.categoryFor("green onion")).toBe("Produce");
	});

	it("is Uncategorized when nothing matches", () => {
		expect(catalog.categoryFor("toothpaste")).toBe("Uncategorized");
	});
});

describe("IngredientCatalog — dietary groups", () => {
	it("counts every ingredient in the line", () => {
		expect([...catalog.groupsFor("butter and almonds")].sort()).toEqual(["Dairy", "Tree Nuts"]);
	});

	it("drops a match inside a longer one", () => {
		expect(catalog.inGroup("full-fat coconut milk", "Dairy")).toBe(false);
	});

	it("counts the real thing next to a look-alike", () => {
		expect(catalog.inGroup("coconut milk and whole milk", "Dairy")).toBe(true);
	});

	it("respects a free-of modifier", () => {
		expect(catalog.inGroup("gluten-free flour", "Gluten")).toBe(false);
		expect(catalog.inGroup("plain flour", "Gluten")).toBe(true);
	});
});

describe("IngredientCatalog — staples", () => {
	it("finds a staple by a word in the line", () => {
		expect(catalog.isStaple("kosher salt")).toBe(true);
		expect(catalog.isStaple("2 tbsp butter")).toBe(true);
		expect(catalog.isStaple("whole milk")).toBe(false);
	});
});

describe("saysFreeOf", () => {
	it("reads the group's name, singular or plural", () => {
		expect(saysFreeOf("dairy-free yogurt", "Dairy")).toBe(true);
		expect(saysFreeOf("egg free mayo", "Eggs")).toBe(true);
		expect(saysFreeOf("free-range eggs", "Eggs")).toBe(false);
	});
});
