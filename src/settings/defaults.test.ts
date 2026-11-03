import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { cloneDefaultSettings } from "./index";

describe("default shopping categories", () => {
	it("has no duplicate names", () => {
		const names = DEFAULT_SETTINGS.shoppingCategories.map((c) => c.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every category a name and at least one ingredient", () => {
		for (const c of DEFAULT_SETTINGS.shoppingCategories) {
			expect(c.name.trim()).not.toBe("");
			expect(DEFAULT_SETTINGS.ingredients.some((i) => i.category === c.name)).toBe(true);
		}
	});
});

describe("default ingredient groups", () => {
	it("has no duplicate names", () => {
		const names = DEFAULT_SETTINGS.ingredientGroups.map((g) => g.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every group a name and at least one ingredient", () => {
		for (const g of DEFAULT_SETTINGS.ingredientGroups) {
			expect(g.name.trim()).not.toBe("");
			expect(DEFAULT_SETTINGS.ingredients.some((i) => i.groups.includes(g.name))).toBe(true);
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

describe("default ingredients", () => {
	it("lists every name once, ignoring letter case", () => {
		const names = DEFAULT_SETTINGS.ingredients.flatMap((i) => [i.name, ...i.otherNames]).map((n) => n.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
	});

	it("only uses categories and groups that exist", () => {
		const categories = new Set(DEFAULT_SETTINGS.shoppingCategories.map((c) => c.name));
		const groups = new Set(DEFAULT_SETTINGS.ingredientGroups.map((g) => g.name));
		for (const i of DEFAULT_SETTINGS.ingredients) {
			if (i.category) expect(categories).toContain(i.category);
			for (const g of i.groups) expect(groups).toContain(g);
		}
	});
});

describe("cloneDefaultSettings", () => {
	it("deep-copies the lists so edits cannot corrupt the defaults", () => {
		const a = cloneDefaultSettings();
		a.shoppingCategories[0]!.name = "MUTATED";
		a.ingredientGroups[0]!.name = "MUTATED";
		a.ingredients[0]!.groups.push("MUTATED");
		a.ingredients[0]!.otherNames.push("MUTATED");
		a.storeLayouts[0]!.aisleOrder.push("MUTATED");

		const b = cloneDefaultSettings();
		expect(b.shoppingCategories[0]!.name).not.toBe("MUTATED");
		expect(b.ingredientGroups[0]!.name).not.toBe("MUTATED");
		expect(b.ingredients[0]!.groups).not.toContain("MUTATED");
		expect(b.ingredients[0]!.otherNames).not.toContain("MUTATED");
		expect(b.storeLayouts[0]!.aisleOrder).not.toContain("MUTATED");
	});
});
