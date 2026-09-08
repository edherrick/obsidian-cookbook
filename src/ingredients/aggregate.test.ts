import { describe, it, expect } from "vitest";
import { aggregateItems } from "./aggregate";
import { item } from "../__mocks__/testHelpers";

describe("aggregateItems", () => {
	it("sums items with the same name and same unit", () => {
		const result = aggregateItems([item("milk", 1, "cups"), item("milk", 0.5, "cups")]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(1.5);
	});

	it("converts and sums items with different but compatible volume units", () => {
		const result = aggregateItems([item("milk", 1, "cup"), item("milk", 4, "tbsp")]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBeCloseTo(1.25, 1);
	});

	it("converts and sums items with different weight units", () => {
		const result = aggregateItems([item("flour", 1, "kg"), item("flour", 500, "g")]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBeCloseTo(1.5, 2);
	});

	it("keeps volume and weight items separate for the same ingredient", () => {
		expect(aggregateItems([item("butter", 1, "cup"), item("butter", 100, "g")])).toHaveLength(2);
	});

	it("keeps different count units separate", () => {
		expect(aggregateItems([item("garlic", 2, "cloves"), item("garlic", 1, "head")])).toHaveLength(2);
	});

	it("sums matching count units", () => {
		const result = aggregateItems([item("garlic", 2, "cloves"), item("garlic", 4, "cloves")]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(6);
	});

	it("aggregates items with no unit by name", () => {
		expect(aggregateItems([item("salt", null, null), item("salt", null, null)])).toHaveLength(1);
	});

	it("treats items with different names as separate entries", () => {
		expect(aggregateItems([item("milk", 1, "cups"), item("cream", 1, "cups")])).toHaveLength(2);
	});

	it("merges names that differ only by a descriptor", () => {
		// The display text of the first item wins; the second is folded in
		const result = aggregateItems([item("shredded cheddar cheese", 1, "cups"), item("cheddar cheese", 2, "cups")]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(3);
		expect(result[0]!.text).toBe("shredded cheddar cheese");
	});

	it("merges an ingredient whose duplicate carried a prep clause", () => {
		const result = aggregateItems([
			item("soy sauce", 2, "tbsp"),
			item("soy sauce", 3, "tbsp", { prep: "to taste" }),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(5);
		expect(result[0]!.prep).toBe("to taste");
	});

	it("merges recipeTitle into a comma-separated string", () => {
		const result = aggregateItems([
			item("milk", 1, "cups", { recipeTitle: "Soup" }),
			item("milk", 1, "cups", { recipeTitle: "Cake" }),
		]);
		expect(result[0]!.recipeTitle).toBe("Soup, Cake");
	});

	it("does not repeat a recipe title that is already listed", () => {
		const result = aggregateItems([
			item("milk", 1, "cups", { recipeTitle: "Soup" }),
			item("milk", 1, "cups", { recipeTitle: "Soup" }),
		]);
		expect(result[0]!.recipeTitle).toBe("Soup");
	});

	it("keeps the existing quantity when a second unitless item has null quantity", () => {
		const result = aggregateItems([item("salt", 2, null), item("salt", null, null)]);
		expect(result[0]!.quantity).toBe(2);
	});

	it("adopts a quantity when the first occurrence had none", () => {
		const result = aggregateItems([item("salt", null, null), item("salt", 2, null)]);
		expect(result[0]!.quantity).toBe(2);
	});
});
