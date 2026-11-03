import { describe, it, expect } from "vitest";
import { cloneDefaultSettings } from "./index";
import { renameCategory } from "./renameCategory";

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
		const before = structuredClone(s);
		renameCategory(s, "Pantry", "  ");
		expect(s).toEqual(before);
	});
});
