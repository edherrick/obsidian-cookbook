import { describe, it, expect } from "vitest";
import {
	buildFilterOptions,
	initialFilterFor,
	recipeMatchesFilters,
	toFilterValues,
	HAS_GROUP_KEY,
	HAS_INGREDIENT_KEY,
} from "./model";
import type { FilterContext, FilterValue } from "./model";
import type { Recipe } from "../recipes/repository";
import type { ParsedIngredient } from "../ingredients/parse";

const EXCLUDED = new Set(["path", "__tags", "cook_soon", "cook_multiplier", "title", "tags"]);

function recipe(path: string, fm: Record<string, unknown> = {}): Recipe {
	return {
		path,
		cook_soon: false,
		cook_multiplier: 1,
		title: path,
		__tags: [],
		...fm,
	} as Recipe;
}

function ingredients(...texts: string[]): ParsedIngredient[] {
	return texts.map((text) => ({ quantity: null, unit: null, text }));
}

function ctx(map: Record<string, ParsedIngredient[]> = {}): FilterContext {
	return {
		ingredientsByPath: new Map(Object.entries(map)),
		ingredientGroups: [
			{ name: "Dairy", keywords: ["milk", "cheese", "butter"] },
			{ name: "Gluten", keywords: ["flour", "pasta", "bread"] },
		],
	};
}

describe("toFilterValues", () => {
	it("returns one value for a scalar", () => {
		expect(toFilterValues("Italian")).toEqual(["Italian"]);
	});

	it("returns one value per list entry", () => {
		expect(toFilterValues(["Dinner", "Vegetarian"])).toEqual(["Dinner", "Vegetarian"]);
	});

	it("drops null and empty entries", () => {
		expect(toFilterValues([null, "Dinner", ""])).toEqual(["Dinner"]);
		expect(toFilterValues(null)).toEqual([]);
		expect(toFilterValues("")).toEqual([]);
	});
});

describe("buildFilterOptions", () => {
	it("offers each list entry as its own option", () => {
		// A joined "Dinner,Vegetarian" option matched no recipe but its own
		const options = buildFilterOptions(
			[
				recipe("a.md", { "meal-type": ["Dinner", "Vegetarian"] }),
				recipe("b.md", { "meal-type": ["Lunch"] }),
			],
			EXCLUDED,
		);
		expect(options.get("meal-type")!.values).toEqual(["Dinner", "Lunch", "Vegetarian"]);
	});

	it("flags an all-numeric property as numeric", () => {
		const options = buildFilterOptions(
			[recipe("a.md", { "cook-time": 30 }), recipe("b.md", { "cook-time": 45 })],
			EXCLUDED,
		);
		expect(options.get("cook-time")!.isNumeric).toBe(true);
	});

	it("skips excluded and internal keys", () => {
		const options = buildFilterOptions([recipe("a.md", { cuisine: "Thai" })], EXCLUDED);
		expect([...options.keys()]).toEqual(["cuisine"]);
	});

	it("skips properties with no value", () => {
		const options = buildFilterOptions([recipe("a.md", { rating: null })], EXCLUDED);
		expect(options.has("rating")).toBe(false);
	});
});

describe("recipeMatchesFilters — string filters", () => {
	const filters = (value: string) =>
		new Map<string, FilterValue>([["meal-type", { type: "string", value }]]);

	it("matches a recipe whose list contains the value", () => {
		expect(
			recipeMatchesFilters(recipe("a.md", { "meal-type": ["Dinner", "Vegetarian"] }), filters("Dinner"), ctx()),
		).toBe(true);
	});

	it("matches on a later list entry too", () => {
		expect(
			recipeMatchesFilters(
				recipe("a.md", { "meal-type": ["Dinner", "Vegetarian"] }),
				filters("Vegetarian"),
				ctx(),
			),
		).toBe(true);
	});

	it("rejects a recipe without the value", () => {
		expect(recipeMatchesFilters(recipe("a.md", { "meal-type": ["Lunch"] }), filters("Dinner"), ctx())).toBe(
			false,
		);
	});

	it("matches a scalar property", () => {
		const f = new Map<string, FilterValue>([["cuisine", { type: "string", value: "Thai" }]]);
		expect(recipeMatchesFilters(recipe("a.md", { cuisine: "Thai" }), f, ctx())).toBe(true);
	});

	it("ignores an empty filter value", () => {
		expect(recipeMatchesFilters(recipe("a.md"), filters(""), ctx())).toBe(true);
	});
});

describe("recipeMatchesFilters — numeric filters", () => {
	const f = (op: "<" | "=" | ">", value: string) =>
		new Map<string, FilterValue>([["cook-time", { type: "numeric", op, value }]]);

	it("applies <", () => {
		expect(recipeMatchesFilters(recipe("a.md", { "cook-time": 20 }), f("<", "30"), ctx())).toBe(true);
		expect(recipeMatchesFilters(recipe("a.md", { "cook-time": 40 }), f("<", "30"), ctx())).toBe(false);
	});

	it("applies =", () => {
		expect(recipeMatchesFilters(recipe("a.md", { "cook-time": 30 }), f("=", "30"), ctx())).toBe(true);
	});

	it("applies >", () => {
		expect(recipeMatchesFilters(recipe("a.md", { "cook-time": 40 }), f(">", "30"), ctx())).toBe(true);
	});
});

describe("recipeMatchesFilters — ingredient filters", () => {
	const context = ctx({ "a.md": ingredients("chicken breasts", "soy sauce") });

	it("AND requires every ingredient", () => {
		const f = new Map<string, FilterValue>([
			[HAS_INGREDIENT_KEY, { type: "has-ingredient", ingredients: ["chicken", "soy"], logic: "and" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(true);
	});

	it("AND fails when one is missing", () => {
		const f = new Map<string, FilterValue>([
			[HAS_INGREDIENT_KEY, { type: "has-ingredient", ingredients: ["chicken", "beef"], logic: "and" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(false);
	});

	it("OR needs only one", () => {
		const f = new Map<string, FilterValue>([
			[HAS_INGREDIENT_KEY, { type: "has-ingredient", ingredients: ["chicken", "beef"], logic: "or" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(true);
	});

	it("excludes rejects a match", () => {
		const f = new Map<string, FilterValue>([
			["__excludes-ingredient", { type: "excludes-ingredient", ingredients: ["chicken"] }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(false);
	});
});

describe("recipeMatchesFilters — group filters", () => {
	it("matches a group by whole word", () => {
		const context = ctx({ "a.md": ingredients("2 cups whole milk") });
		const f = new Map<string, FilterValue>([
			[HAS_GROUP_KEY, { type: "has-group", groups: ["Dairy"], logic: "or" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(true);
	});

	it("does not match a group on a substring", () => {
		// "buttercup squash" is not butter; the old substring matcher said it was
		const context = ctx({ "a.md": ingredients("buttercup squash") });
		const f = new Map<string, FilterValue>([
			[HAS_GROUP_KEY, { type: "has-group", groups: ["Dairy"], logic: "or" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(false);
	});

	it("excludes-group rejects a recipe containing the group", () => {
		const context = ctx({ "a.md": ingredients("all purpose flour") });
		const f = new Map<string, FilterValue>([
			["__excludes-group", { type: "excludes-group", groups: ["Gluten"] }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(false);
	});

	it("ignores an unknown group name", () => {
		const context = ctx({ "a.md": ingredients("milk") });
		const f = new Map<string, FilterValue>([
			[HAS_GROUP_KEY, { type: "has-group", groups: ["Nope"], logic: "or" }],
		]);
		expect(recipeMatchesFilters(recipe("a.md"), f, context)).toBe(false);
	});
});

describe("initialFilterFor", () => {
	it("creates a numeric filter for a numeric property", () => {
		expect(initialFilterFor("cook-time", { values: ["30"], isNumeric: true })).toEqual({
			type: "numeric",
			op: "=",
			value: "",
		});
	});

	it("creates a string filter otherwise", () => {
		expect(initialFilterFor("cuisine", { values: ["Thai"], isNumeric: false })).toEqual({
			type: "string",
			value: "",
		});
	});

	it("creates the synthetic ingredient filter", () => {
		expect(initialFilterFor(HAS_INGREDIENT_KEY)).toEqual({
			type: "has-ingredient",
			ingredients: [],
			logic: "and",
		});
	});
});
