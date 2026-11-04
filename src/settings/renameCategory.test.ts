import { describe, it, expect } from "vitest";
import { cloneDefaultSettings } from "./index";
import { deleteCategory, deleteGroup, deleteIngredient, renameCategory, renameGroup, renameIngredient } from "./renameCategory";

describe("renameCategory", () => {
	it("renames the category in every store route, keeping its place", () => {
		const s = cloneDefaultSettings();
		const route = s.storeLayouts[0]!.aisleOrder;
		const at = route.indexOf("Pantry");
		renameCategory(s, "Pantry", "Dry goods");
		expect(s.storeLayouts[0]!.aisleOrder[at]).toBe("Dry goods");
		expect(s.storeLayouts[0]!.aisleOrder).not.toContain("Pantry");
	});

	it("renames ignored aisles in any letter case", () => {
		const s = cloneDefaultSettings();
		s.overlapIgnoreCategories = ["pantry", "Frozen"];
		renameCategory(s, "Pantry", "Dry goods");
		expect(s.overlapIgnoreCategories).toEqual(["Dry goods", "Frozen"]);
	});

	it("drops the old name instead of listing the new one twice", () => {
		const s = cloneDefaultSettings();
		s.overlapIgnoreCategories = ["Pantry", "Dry goods"];
		renameCategory(s, "Pantry", "Dry goods");
		expect(s.overlapIgnoreCategories).toEqual(["Dry goods"]);
	});

	it("ignores a rename to an empty name", () => {
		const s = cloneDefaultSettings();
		const before = structuredClone(s) as typeof s;
		renameCategory(s, "Pantry", "  ");
		expect(s).toEqual(before);
	});
});

describe("category and group changes reach the ingredients", () => {
	it("moves ingredients to a renamed category", () => {
		const s = cloneDefaultSettings();
		const count = s.ingredients.filter((i) => i.category === "Pantry").length;
		renameCategory(s, "Pantry", "Dry goods");
		expect(s.ingredients.filter((i) => i.category === "Dry goods")).toHaveLength(count);
		expect(s.ingredients.some((i) => i.category === "Pantry")).toBe(false);
	});

	it("leaves a deleted category's ingredients Uncategorized", () => {
		const s = cloneDefaultSettings();
		deleteCategory(s, "Frozen");
		expect(s.ingredients.some((i) => i.category === "Frozen")).toBe(false);
		expect(s.storeLayouts[0]!.aisleOrder).not.toContain("Frozen");
	});

	it("renames and removes dietary tags", () => {
		const s = cloneDefaultSettings();
		renameGroup(s, "Dairy", "Milk products");
		expect(s.ingredients.find((i) => i.name === "butter")?.groups).toContain("Milk products");
		deleteGroup(s, "Milk products");
		expect(s.ingredients.some((i) => i.groups.includes("Milk products"))).toBe(false);
	});
});

describe("changes reach store aisles", () => {
	const withAisle = () => {
		const s = cloneDefaultSettings();
		s.storeLayouts[0]!.aisles = [{ number: 7, categories: ["Pantry"], ingredients: ["soy sauce"] }];
		return s;
	};

	it("renames and removes categories in aisles", () => {
		const s = withAisle();
		renameCategory(s, "Pantry", "Dry goods");
		expect(s.storeLayouts[0]!.aisles![0]!.categories).toEqual(["Dry goods"]);
		deleteCategory(s, "Dry goods");
		expect(s.storeLayouts[0]!.aisles![0]!.categories).toEqual([]);
	});

	it("renames and removes moved ingredients", () => {
		const s = withAisle();
		renameIngredient(s, "soy sauce", "shoyu");
		expect(s.storeLayouts[0]!.aisles![0]!.ingredients).toEqual(["shoyu"]);
		deleteIngredient(s, "Shoyu");
		expect(s.storeLayouts[0]!.aisles![0]!.ingredients).toEqual([]);
	});
});
