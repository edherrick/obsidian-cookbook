import { describe, it, expect } from "vitest";
import {
	parseIngredient,
	formatQty,
	assignCategory,
	aggregateItems,
} from "./recipeUtils";
import type { ShoppingItem } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function item(
	text: string,
	quantity: number | null,
	unit: string | null,
	extra: Partial<ShoppingItem> = {},
): ShoppingItem {
	return {
		id: "0",
		text,
		quantity,
		unit,
		checked: false,
		category: "Uncategorized",
		source: "recipe",
		...extra,
	};
}

// ─── parseIngredient ──────────────────────────────────────────────────────────

describe("parseIngredient", () => {
	it("parses integer + unit + text", () => {
		expect(parseIngredient("2 cups flour")).toEqual({ quantity: 2, unit: "cups", text: "flour" });
	});

	it("parses decimal + unit + text", () => {
		expect(parseIngredient("1.5 cups milk")).toEqual({ quantity: 1.5, unit: "cups", text: "milk" });
	});

	it("parses a simple fraction", () => {
		expect(parseIngredient("1/2 cup sugar")).toEqual({ quantity: 0.5, unit: "cup", text: "sugar" });
	});

	it("parses a mixed number", () => {
		expect(parseIngredient("1 1/2 cups milk")).toEqual({ quantity: 1.5, unit: "cups", text: "milk" });
	});

	it("takes the first value of a range", () => {
		expect(parseIngredient("2-3 cloves garlic")).toEqual({ quantity: 2, unit: null, text: "cloves garlic" });
	});

	it("strips a leading approximate marker", () => {
		expect(parseIngredient("~1 tsp salt")).toEqual({ quantity: 1, unit: "tsp", text: "salt" });
	});

	it("returns null quantity for bare text", () => {
		expect(parseIngredient("salt to taste")).toEqual({ quantity: null, unit: null, text: "salt to taste" });
	});

	it("parses weight units", () => {
		expect(parseIngredient("200g chicken")).toEqual({ quantity: 200, unit: "g", text: "chicken" });
	});

	it("parses a two-word unit (fl oz)", () => {
		expect(parseIngredient("4 fl oz cream")).toEqual({ quantity: 4, unit: "fl oz", text: "cream" });
	});

	it("treats an unknown word after the number as part of the text", () => {
		const result = parseIngredient("3 medium carrots");
		expect(result.quantity).toBe(3);
		expect(result.unit).toBeNull();
		expect(result.text).toBe("medium carrots");
	});

	it("handles number glued directly to a unit (no space)", () => {
		expect(parseIngredient("100g butter")).toEqual({ quantity: 100, unit: "g", text: "butter" });
	});
});

// ─── formatQty ────────────────────────────────────────────────────────────────

describe("formatQty", () => {
	it("formats a whole number", () => {
		expect(formatQty(2)).toBe("2");
	});

	it("formats 0.5 as 1/2", () => {
		expect(formatQty(0.5)).toBe("1/2");
	});

	it("formats 0.25 as 1/4", () => {
		expect(formatQty(0.25)).toBe("1/4");
	});

	it("formats 1.5 as 1 1/2", () => {
		expect(formatQty(1.5)).toBe("1 1/2");
	});

	it("formats 2.75 as 2 3/4", () => {
		expect(formatQty(2.75)).toBe("2 3/4");
	});

	it("formats 0.33 as approximately 1/3", () => {
		expect(formatQty(1 / 3)).toBe("1/3");
	});

	it("formats 0.67 as approximately 2/3", () => {
		expect(formatQty(2 / 3)).toBe("2/3");
	});

	it("formats 0.125 as 1/8", () => {
		expect(formatQty(0.125)).toBe("1/8");
	});

	it("rounds near-whole fractions up when fractional part exceeds 0.99", () => {
		expect(formatQty(1.999)).toBe("2");
	});
});

// ─── assignCategory ───────────────────────────────────────────────────────────

describe("assignCategory", () => {
	const categories = [
		{ name: "Dairy", keywords: ["milk", "butter", "cream", "cheese"] },
		{ name: "Produce", keywords: ["carrot", "onion", "garlic"] },
	];

	it("matches a keyword exactly", () => {
		expect(assignCategory("milk", categories)).toBe("Dairy");
	});

	it("matches a keyword as a substring", () => {
		expect(assignCategory("heavy cream", categories)).toBe("Dairy");
	});

	it("matches case-insensitively", () => {
		expect(assignCategory("BUTTER", categories)).toBe("Dairy");
	});

	it("returns Uncategorized when no keyword matches", () => {
		expect(assignCategory("lemon juice", categories)).toBe("Uncategorized");
	});

	it("returns Uncategorized when category list is empty", () => {
		expect(assignCategory("milk", [])).toBe("Uncategorized");
	});

	it("matches the first category when multiple would match", () => {
		const overlap = [
			{ name: "First", keywords: ["cream"] },
			{ name: "Second", keywords: ["cream"] },
		];
		expect(assignCategory("cream", overlap)).toBe("First");
	});
});

// ─── aggregateItems ───────────────────────────────────────────────────────────

describe("aggregateItems", () => {
	it("sums items with the same name and same unit", () => {
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("milk", 0.5, "cups"),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(1.5);
		expect(result[0]!.unit).toBe("cups");
	});

	it("converts and sums items with different but compatible volume units", () => {
		// 1 cup + 1 cup (via 16 tbsp) = 2 cups
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("milk", 16, "tbsp"),
		]);
		expect(result).toHaveLength(1);
		// 1 cup = 236.59ml, 16 tbsp = 16 * 14.79 = 236.64ml ≈ 473ml ≈ 2 cups
		expect(result[0]!.unit).toBe("cups");
		expect(result[0]!.quantity).toBeCloseTo(2, 0);
	});

	it("converts and sums items with different weight units", () => {
		// 500g + 0.5kg = 1kg
		const result = aggregateItems(
			[item("flour", 500, "g"), item("flour", 0.5, "kg")],
			{ preferredWeightUnit: "kg" },
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.unit).toBe("kg");
		expect(result[0]!.quantity).toBe(1);
	});

	it("keeps volume and weight items separate for the same ingredient", () => {
		const result = aggregateItems([
			item("flour", 2, "cups"),
			item("flour", 200, "g"),
		]);
		expect(result).toHaveLength(2);
	});

	it("aggregates items with no unit by name", () => {
		const result = aggregateItems([
			item("eggs", 2, null),
			item("eggs", 3, null),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(5);
		expect(result[0]!.unit).toBeNull();
	});

	it("treats items with different names as separate entries", () => {
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("cream", 1, "cups"),
		]);
		expect(result).toHaveLength(2);
	});

	it("merges recipeTitle into a comma-separated string", () => {
		const result = aggregateItems([
			item("milk", 1, "cups", { recipeTitle: "Pancakes" }),
			item("milk", 1, "cups", { recipeTitle: "Waffles" }),
		]);
		expect(result[0]!.recipeTitle).toBe("Pancakes, Waffles");
	});

	it("keeps the existing quantity when a second unitless item has null quantity", () => {
		// Both items have no unit so they share the same aggregation key
		const result = aggregateItems([
			item("salt", 1, null),
			item("salt", null, null),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(1);
	});
});
