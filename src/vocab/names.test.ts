import { describe, it, expect } from "vitest";
import { indexIngredientNames, likelyDuplicates, mergeAlias } from "./names";
import { Vocabulary } from "./vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";
import type { IngredientAlias } from "../types";

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

describe("mergeAlias", () => {
	it("adds the source as an alias of the target, creating the group if needed", () => {
		const aliases: IngredientAlias[] = [];
		mergeAlias(aliases, "red apple", "apple");
		expect(aliases).toEqual([{ name: "apple", keywords: ["red apple"] }]);
	});

	it("moves a merged group's own aliases along with it", () => {
		const aliases: IngredientAlias[] = [
			{ name: "spring onion", keywords: ["green onion"] },
			{ name: "scallion", keywords: [] },
		];
		mergeAlias(aliases, "spring onion", "scallion");
		expect(aliases).toEqual([{ name: "scallion", keywords: ["spring onion", "green onion"] }]);
	});

	it("ignores merging a name into itself", () => {
		const aliases: IngredientAlias[] = [];
		mergeAlias(aliases, "Kale", "kale");
		expect(aliases).toEqual([]);
	});
});
