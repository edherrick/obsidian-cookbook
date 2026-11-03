import { describe, it, expect } from "vitest";
import { renameListCategory } from "./listEdits";
import type { PersistedShoppingList, ShoppingItem } from "../types";

const item = (text: string, category: string): ShoppingItem => ({
	id: text,
	text,
	quantity: null,
	unit: null,
	checked: false,
	category,
	source: "recipe",
});

const list = (): PersistedShoppingList => ({
	items: [item("rice", "Pantry"), item("kale", "Produce")],
	categoryOrder: ["Produce", "Pantry", "Uncategorized"],
	generatedAt: 1,
});

describe("renameListCategory", () => {
	it("renames the category on items and in the order", () => {
		const next = renameListCategory(list(), "Pantry", "Dry goods")!;
		expect(next.items.map((i) => i.category)).toEqual(["Dry goods", "Produce"]);
		expect(next.categoryOrder).toEqual(["Produce", "Dry goods", "Uncategorized"]);
	});

	it("leaves a deleted category's items Uncategorized", () => {
		const next = renameListCategory(list(), "Pantry", null)!;
		expect(next.items[0]!.category).toBe("");
		expect(next.categoryOrder).toEqual(["Produce", "Uncategorized"]);
	});

	it("keeps one place when renaming onto a listed name", () => {
		const next = renameListCategory(list(), "Pantry", "Produce")!;
		expect(next.categoryOrder).toEqual(["Produce", "Uncategorized"]);
	});

	it("returns null when the list doesn't use the category", () => {
		expect(renameListCategory(list(), "Frozen", "Freezer")).toBeNull();
	});
});
