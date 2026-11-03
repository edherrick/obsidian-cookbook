import { describe, it, expect } from "vitest";
import { indexIngredientNames, likelyDuplicates, mergeIngredientName } from "./names";
import { Vocabulary } from "./vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";
import type { Ingredient } from "../types";

const vocab = new Vocabulary(DEFAULT_SETTINGS);
const parse = (lines: string[]) => lines.map(parseIngredient);

describe("indexIngredientNames", () => {
	it("counts recipes per ingredient, folding plurals and aliases", () => {
		const names = indexIngredientNames(
			[
				["Oats", parse(["3 red apples", "2 green onions"])],
				["Soup", parse(["1 large red apple", "1 scallion"])],
			],
			vocab,
		);
		expect(names).toEqual([
			{ name: "red apples", key: "red apple", recipes: ["Oats", "Soup"] },
			{ name: "scallion", key: "scallion", recipes: ["Oats", "Soup"] },
		]);
	});
});

describe("likelyDuplicates", () => {
	const names = [
		{ name: "apple", key: "apple", recipes: [] },
		{ name: "red apple", key: "red apple", recipes: [] },
		{ name: "ceasar dressing", key: "ceasar dressing", recipes: [] },
		{ name: "caesar dressing", key: "caesar dressing", recipes: [] },
		{ name: "feta cheese", key: "feta cheese", recipes: [] },
		{ name: "cheddar cheese", key: "cheddar cheese", recipes: [] },
	];
	const dupes = likelyDuplicates(names);

	it("suggests suffix matches and near spellings", () => {
		expect(dupes.get("apple")).toEqual(["red apple"]);
		expect(dupes.get("ceasar dressing")).toEqual(["caesar dressing"]);
	});

	it("leaves different ingredients that share a word", () => {
		expect(dupes.has("feta cheese")).toBe(false);
	});
});

describe("mergeIngredientName", () => {
	const ing = (name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
		name,
		otherNames: [],
		category: "",
		groups: [],
		...extra,
	});

	it("adds the source as another name of the target, creating the target if needed", () => {
		const list: Ingredient[] = [];
		mergeIngredientName(list, "red apple", "apple");
		expect(list).toEqual([ing("apple", { otherNames: ["red apple"] })]);
	});

	it("folds a listed source into the target, other names and all", () => {
		const list = [ing("spring onion", { otherNames: ["green onion"], category: "Produce" }), ing("scallion")];
		mergeIngredientName(list, "spring onion", "scallion");
		expect(list).toEqual([ing("scallion", { otherNames: ["spring onion", "green onion"] })]);
	});

	it("gives a new target the source's category and tags", () => {
		const list = [ing("parmigiano", { category: "Dairy & Eggs", groups: ["Dairy"], staple: true })];
		mergeIngredientName(list, "parmigiano", "parmesan");
		expect(list).toEqual([
			ing("parmesan", { otherNames: ["parmigiano"], category: "Dairy & Eggs", groups: ["Dairy"], staple: true }),
		]);
	});

	it("takes the name away from another ingredient that listed it", () => {
		const list = [ing("onion", { otherNames: ["shallot"] }), ing("shallot bulb")];
		mergeIngredientName(list, "shallot", "shallot bulb");
		expect(list).toEqual([ing("onion"), ing("shallot bulb", { otherNames: ["shallot"] })]);
	});

	it("ignores merging a name into itself", () => {
		const list: Ingredient[] = [];
		mergeIngredientName(list, "Kale", "kale");
		expect(list).toEqual([]);
	});
});
