import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { cloneDefaultSettings } from "./index";

describe("default shopping categories", () => {
	it("has no duplicate names", () => {
		const names = DEFAULT_SETTINGS.shoppingCategories.map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every category a name and at least one keyword", () => {
		for (const c of DEFAULT_SETTINGS.shoppingCategories) {
			expect(c.name.trim()).not.toBe("");
			expect(c.keywords.length).toBeGreaterThan(0);
		}
	});
});

describe("default ingredient groups", () => {
	it("has no duplicate names", () => {
		const names = DEFAULT_SETTINGS.ingredientGroups.map((g) => g.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every group a name and at least one keyword", () => {
		for (const g of DEFAULT_SETTINGS.ingredientGroups) {
			expect(g.name.trim()).not.toBe("");
			expect(g.keywords.length).toBeGreaterThan(0);
		}
	});

	it("covers the major allergens as separately filterable groups", () => {
		const names = DEFAULT_SETTINGS.ingredientGroups.map((g) => g.name);
		for (const required of ["Dairy", "Eggs", "Fish", "Shellfish", "Tree Nuts", "Peanuts", "Soy", "Sesame", "Gluten"]) {
			expect(names).toContain(required);
		}
	});
});

describe("default store layout", () => {
	// A category with no place in the route would silently fall to the bottom
	// of every shopping list, so the default layout must stay in step.
	it("lists exactly the default categories, in the same order", () => {
		const layout = DEFAULT_SETTINGS.storeLayouts[0]!;
		expect(layout.aisleOrder).toEqual(DEFAULT_SETTINGS.shoppingCategories.map((c) => c.name));
	});

	it("is the active layout", () => {
		expect(DEFAULT_SETTINGS.activeStoreLayout).toBe(DEFAULT_SETTINGS.storeLayouts[0]!.name);
	});
});

describe("cloneDefaultSettings", () => {
	it("deep-copies the lists so edits cannot corrupt the defaults", () => {
		const a = cloneDefaultSettings();
		a.shoppingCategories[0]!.keywords.push("MUTATED");
		a.ingredientGroups[0]!.name = "MUTATED";
		a.storeLayouts[0]!.aisleOrder.push("MUTATED");

		const b = cloneDefaultSettings();
		expect(b.shoppingCategories[0]!.keywords).not.toContain("MUTATED");
		expect(b.ingredientGroups[0]!.name).not.toBe("MUTATED");
		expect(b.storeLayouts[0]!.aisleOrder).not.toContain("MUTATED");
	});

	it("copies exclusion lists rather than sharing them", () => {
		const a = cloneDefaultSettings();
		const dairy = a.ingredientGroups.find((g) => g.name === "Dairy")!;
		dairy.excludeKeywords!.push("MUTATED");
		const b = cloneDefaultSettings();
		expect(b.ingredientGroups.find((g) => g.name === "Dairy")!.excludeKeywords).not.toContain("MUTATED");
	});
});
