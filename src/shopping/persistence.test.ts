import { describe, it, expect } from "vitest";
import {
	getItemsInDisplayOrder,
	parseShoppingListFromMarkdown,
	serializeShoppingList,
} from "./persistence";
import type { PersistedShoppingList } from "../types";
import { item } from "../__mocks__/testHelpers";

function list(): PersistedShoppingList {
	return {
		items: [
			{ ...item("garlic", 2, "cloves"), id: "0", category: "Produce" },
			{ ...item("milk", 1, "cups"), id: "1", category: "Dairy" },
			{ ...item("onion", 1, null), id: "2", category: "Produce" },
			{ ...item("toothpaste", null, null), id: "3", category: "Uncategorized", source: "custom" },
		],
		categoryOrder: ["Produce", "Dairy", "Uncategorized"],
		generatedAt: 1_700_000_000_000,
	};
}

describe("getItemsInDisplayOrder", () => {
	it("groups by category and follows categoryOrder", () => {
		expect(getItemsInDisplayOrder(list()).map((i) => i.text)).toEqual([
			"garlic",
			"onion",
			"milk",
			"toothpaste",
		]);
	});

	it("puts categories missing from the order list at the end", () => {
		const data = list();
		data.categoryOrder = ["Dairy"];
		expect(getItemsInDisplayOrder(data)[0]!.text).toBe("milk");
	});
});

describe("serializeShoppingList", () => {
	it("writes a heading per category, in order", () => {
		const md = serializeShoppingList(list());
		expect(md.indexOf("## Produce")).toBeLessThan(md.indexOf("## Dairy"));
	});

	it("writes quantities as cooking fractions", () => {
		const data = list();
		data.items[1]!.quantity = 1.5;
		expect(serializeShoppingList(data)).toContain("- [ ] 1 1/2 cups milk");
	});

	it("marks checked items", () => {
		const data = list();
		data.items[1]!.checked = true;
		expect(serializeShoppingList(data)).toContain("- [x] 1 cups milk");
	});

	it("appends the state block", () => {
		expect(serializeShoppingList(list())).toMatch(/\n%%\n\{.*\}\n%%$/s);
	});
});

describe("parseShoppingListFromMarkdown", () => {
	it("round-trips a list unchanged", () => {
		const original = list();
		const parsed = parseShoppingListFromMarkdown(serializeShoppingList(original));
		expect(parsed).toEqual(original);
	});

	it("returns null when there is no state block", () => {
		expect(parseShoppingListFromMarkdown("# Shopping List\n- [ ] milk\n")).toBeNull();
	});

	it("returns null when the state block is not valid JSON", () => {
		expect(parseShoppingListFromMarkdown("# List\n\n%%\nnot json\n%%")).toBeNull();
	});

	it("adopts checkbox edits made in the note body", () => {
		const md = serializeShoppingList(list()).replace("- [ ] 1 cups milk", "- [x] 1 cups milk");
		const parsed = parseShoppingListFromMarkdown(md)!;
		expect(parsed.items.find((i) => i.text === "milk")!.checked).toBe(true);
	});

	it("accepts an uppercase [X]", () => {
		const md = serializeShoppingList(list()).replace("- [ ] 1 cups milk", "- [X] 1 cups milk");
		const parsed = parseShoppingListFromMarkdown(md)!;
		expect(parsed.items.find((i) => i.text === "milk")!.checked).toBe(true);
	});

	it("keeps the stored state when the body no longer lines up", () => {
		const md = serializeShoppingList(list()).replace("- [ ] 1 cups milk\n", "");
		const parsed = parseShoppingListFromMarkdown(md)!;
		expect(parsed.items).toHaveLength(4);
		expect(parsed.items.every((i) => !i.checked)).toBe(true);
	});
});
