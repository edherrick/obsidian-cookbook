import { describe, it, expect } from "vitest";
import { aisleFor, groupForStore, resolveRoute } from "./route";
import { UNCATEGORIZED } from "../ingredients/categorize";

const cats = (...names: string[]) => names.map((name) => ({ name, keywords: [] }));

describe("resolveRoute", () => {
	it("keeps the route's order", () => {
		expect(resolveRoute(["Frozen", "Produce", "Deli"], cats("Produce", "Deli", "Frozen"))).toEqual([
			"Frozen",
			"Produce",
			"Deli",
		]);
	});

	it("drops categories that no longer exist", () => {
		expect(resolveRoute(["Produce", "Gone", "Deli"], cats("Produce", "Deli"))).toEqual(["Produce", "Deli"]);
	});

	it("appends categories the route doesn't mention, in category order", () => {
		expect(resolveRoute(["Deli"], cats("Produce", "Deli", "Frozen"))).toEqual(["Deli", "Produce", "Frozen"]);
	});

	it("never includes Uncategorized", () => {
		expect(resolveRoute([UNCATEGORIZED, "Deli"], cats("Deli"))).toEqual(["Deli"]);
	});

	it("uses category order for an empty route", () => {
		expect(resolveRoute([], cats("Produce", "Deli"))).toEqual(["Produce", "Deli"]);
	});

	it("lists a repeated name once", () => {
		expect(resolveRoute(["Deli", "Deli"], cats("Deli"))).toEqual(["Deli"]);
	});
});

describe("aisleFor", () => {
	const layout = {
		name: "Safeway",
		aisleOrder: [],
		aisles: [
			{ number: 12, categories: [], ingredients: ["soy sauce"] },
			{ number: 7, categories: ["Condiments & Sauces", "Baking & Spices"], ingredients: [] },
			{ number: 3, categories: ["Condiments & Sauces"], ingredients: [] },
		],
	};

	it("uses the category's aisle", () => {
		expect(aisleFor(layout, "Baking & Spices", "flour")).toBe(7);
	});

	it("puts a moved ingredient in its own aisle", () => {
		expect(aisleFor(layout, "Condiments & Sauces", "Soy Sauce")).toBe(12);
	});

	it("takes the lowest aisle when a category is listed twice", () => {
		expect(aisleFor(layout, "Condiments & Sauces", "ketchup")).toBe(3);
	});

	it("is undefined for a category in no aisle, or no store", () => {
		expect(aisleFor(layout, "Produce", "kale")).toBeUndefined();
		expect(aisleFor(undefined, "Produce", "kale")).toBeUndefined();
	});
});

describe("groupForStore", () => {
	const item = (text: string, category: string) => ({ text, category });
	const items = [
		item("kale", "Produce"),
		item("soy sauce", "Condiments & Sauces"),
		item("ketchup", "Condiments & Sauces"),
		item("flour", "Baking & Spices"),
		item("toothpaste", ""),
	];
	const layout = {
		name: "Safeway",
		aisleOrder: [],
		aisles: [
			{ number: 7, categories: ["Condiments & Sauces", "Baking & Spices"], ingredients: [] },
			{ number: 2, categories: [], ingredients: ["soy sauce"] },
		],
	};

	it("lists aisles by number, then other categories in order", () => {
		const groups = groupForStore(items, {
			layout,
			categoryOrder: ["Produce"],
			ingredientOf: (i) => i.text,
		});
		expect(groups.map((g) => g.label)).toEqual(["Aisle 2", "Aisle 7", "Produce", UNCATEGORIZED]);
		expect(groups[1]!.detail).toBe("Condiments & Sauces, Baking & Spices");
		expect(groups[1]!.items.map((i) => i.text)).toEqual(["ketchup", "flour"]);
	});

	it("is the category order for a store with no aisles", () => {
		const groups = groupForStore(items, {
			layout: { name: "Default", aisleOrder: [] },
			categoryOrder: ["Baking & Spices", "Produce", "Condiments & Sauces"],
		});
		expect(groups.map((g) => g.category)).toEqual([
			"Baking & Spices",
			"Produce",
			"Condiments & Sauces",
			UNCATEGORIZED,
		]);
	});
});
