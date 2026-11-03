import { describe, it, expect } from "vitest";
import { ingredientsFromKeywordLists, legacyListsFrom, needsIngredientMigration } from "./migrate";
import { STARTER_KEYWORD_LISTS } from "./defaults";
import { convertedData, mergeSettings, toSavedData } from "./index";
import type { LegacyKeywordLists } from "../types";

const lists = (extra: Partial<LegacyKeywordLists> = {}): LegacyKeywordLists => ({
	shoppingCategories: [
		{ name: "Produce", keywords: ["onion", "spring onion"] },
		{ name: "Dairy", keywords: ["milk", "butter"] },
		{ name: "Pantry", keywords: ["coconut milk", "butter"] },
	],
	ingredientGroups: [
		{ name: "Dairy", keywords: ["milk", "butter"], excludeKeywords: ["coconut milk"] },
		{ name: "Gluten", keywords: ["flour"], excludeKeywords: ["gluten-free"] },
	],
	ingredientAliases: [{ name: "scallion", keywords: ["spring onion", "green onion"] }],
	stapleIngredients: ["butter"],
	...extra,
});

const byName = (name: string) => ingredientsFromKeywordLists(lists()).find((i) => i.name === name);

describe("ingredientsFromKeywordLists", () => {
	it("makes each category keyword an ingredient in that category", () => {
		expect(byName("onion")).toMatchObject({ category: "Produce", groups: [] });
		expect(byName("milk")).toMatchObject({ category: "Dairy", groups: ["Dairy"] });
	});

	it("keeps the first category for a keyword listed twice", () => {
		expect(byName("butter")?.category).toBe("Dairy");
	});

	it("turns an exclusion into an ingredient outside the group", () => {
		expect(byName("coconut milk")).toMatchObject({ category: "Pantry", groups: [] });
	});

	it("skips free-of modifiers", () => {
		expect(byName("gluten-free")).toBeUndefined();
	});

	it("marks staples", () => {
		expect(byName("butter")?.staple).toBe(true);
		expect(byName("milk")?.staple).toBeUndefined();
	});

	it("files an alias by its other names when its own name isn't a keyword", () => {
		expect(byName("scallion")?.category).toBe("Produce");
	});

	it("makes alias keywords other names, not ingredients", () => {
		expect(byName("scallion")).toMatchObject({ otherNames: ["spring onion", "green onion"], category: "Produce" });
		expect(byName("spring onion")).toBeUndefined();
	});

	it("lists every name once, ignoring letter case", () => {
		const names = ingredientsFromKeywordLists(
			lists({ stapleIngredients: ["Butter", "BUTTER"] }),
		).map((i) => i.name.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
	});
});

describe("converting saved settings", () => {
	const raw = {
		shoppingCategories: [{ name: "Produce", keywords: ["kale"] }],
		ingredientGroups: [{ name: "Dairy", keywords: ["milk"] }],
		ingredientAliases: [],
		stapleIngredients: ["salt"],
		storeLayouts: [{ name: "Corner shop", aisleOrder: ["Produce"] }],
	};

	it("spots data from before the ingredient list", () => {
		expect(needsIngredientMigration(raw)).toBe(true);
		expect(needsIngredientMigration({ ...raw, ingredients: [] })).toBe(false);
		expect(needsIngredientMigration({})).toBe(false);
	});

	it("converts on load, keeping category and group names", () => {
		const s = mergeSettings(raw);
		expect(s.shoppingCategories).toEqual([{ name: "Produce" }]);
		expect(s.ingredientGroups).toEqual([{ name: "Dairy" }]);
		expect(s.ingredients.map((i) => i.name)).toEqual(["kale", "milk", "salt"]);
		expect(s.storeLayouts[0]!.name).toBe("Corner shop");
	});

	it("falls back to the starter lists for anything missing", () => {
		const old = legacyListsFrom({ stapleIngredients: ["salt"] }, STARTER_KEYWORD_LISTS);
		expect(old.shoppingCategories).toHaveLength(STARTER_KEYWORD_LISTS.shoppingCategories.length);
		expect(old.stapleIngredients).toEqual(["salt"]);
	});

	it("saves the old lists once and drops the retired keys", () => {
		const data = convertedData({ ...raw, shoppingList: { items: [] } }, mergeSettings(raw));
		expect(data.ingredientAliases).toBeUndefined();
		expect(data.stapleIngredients).toBeUndefined();
		expect(data.shoppingList).toEqual({ items: [] });
		expect(data.legacyKeywordLists).toMatchObject({ stapleIngredients: ["salt"] });
		expect(needsIngredientMigration(data)).toBe(false);
	});

	it("leaves converted data alone", () => {
		const ingredients = [{ name: "kale", otherNames: [], category: "Produce", groups: [] }];
		expect(mergeSettings({ ingredients }).ingredients).toEqual(ingredients);
	});
});

describe("saved data stays readable by 1.5", () => {
	it("gives categories and groups an empty keyword list", () => {
		const data = toSavedData(mergeSettings({}));
		for (const c of data.shoppingCategories as { keywords?: unknown }[]) expect(c.keywords).toEqual([]);
		for (const g of data.ingredientGroups as { keywords?: unknown }[]) expect(g.keywords).toEqual([]);
	});

	it("loads them back as names only, without converting again", () => {
		const data = toSavedData(mergeSettings({}));
		expect(needsIngredientMigration(data)).toBe(false);
		expect(mergeSettings(data).shoppingCategories[0]).toEqual({ name: "Produce" });
	});
});
