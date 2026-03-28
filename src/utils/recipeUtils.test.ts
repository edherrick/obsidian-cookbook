import { describe, it, expect, beforeEach } from "vitest";
import {
	parseIngredient,
	formatQty,
	assignCategory,
	aggregateItems,
	isIgnored,
	getRecipes,
	buildShoppingList,
	flushCookSoon,
	applyToggleCookSoon,
	clearIngredientCache,
} from "./recipeUtils";
import { writable } from "svelte/store";
import type { ShoppingItem } from "../types";
import { TFile } from "../__mocks__/obsidian";
import type { App } from "obsidian";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function item(
	text: string,
	quantity: number | null,
	unit: string | null,
	extra: Partial<ShoppingItem> = {},
): ShoppingItem {
	return {
		id: "0",
		text,
		quantity,
		unit,
		checked: false,
		category: "Uncategorized",
		source: "recipe",
		...extra,
	};
}

interface FileFixture {
	path: string;
	frontmatter?: Record<string, unknown>;
	inlineTags?: string[];
	content?: string;
}

function makeApp(files: FileFixture[]): App {
	const tfiles = files.map((f) => new TFile(f.path));
	return {
		vault: {
			getFiles: () => tfiles,
			getFileByPath: (path: string) =>
				tfiles.find((f) => f.path === path) ?? null,
			read: async (file: { path: string }) =>
				files.find((f) => f.path === file.path)?.content ?? "",
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const fixture = files.find((f) => f.path === file.path);
				if (!fixture?.frontmatter) return null;
				return {
					frontmatter: fixture.frontmatter,
					tags:
						fixture.inlineTags?.map((tag: string) => ({ tag })) ??
						[],
				};
			},
		},
		fileManager: {
			processFrontMatter: async (
				file: { path: string },
				fn: (fm: Record<string, unknown>) => void,
			) => {
				const fixture = files.find((f) => f.path === file.path);
				if (fixture?.frontmatter) fn(fixture.frontmatter);
			},
		},
	} as unknown as App;
}

// ─── parseIngredient ──────────────────────────────────────────────────────────

describe("parseIngredient", () => {
	it("parses integer + unit + text", () => {
		expect(parseIngredient("2 cups flour")).toEqual({ quantity: 2, unit: "cups", text: "flour" });
	});

	it("parses decimal + unit + text", () => {
		expect(parseIngredient("1.5 cups milk")).toEqual({ quantity: 1.5, unit: "cups", text: "milk" });
	});

	it("parses a simple fraction", () => {
		expect(parseIngredient("1/2 cup sugar")).toEqual({ quantity: 0.5, unit: "cup", text: "sugar" });
	});

	it("parses a mixed number", () => {
		expect(parseIngredient("1 1/2 cups milk")).toEqual({ quantity: 1.5, unit: "cups", text: "milk" });
	});

	it("takes the first value of a range", () => {
		expect(parseIngredient("2-3 cloves garlic")).toEqual({ quantity: 2, unit: null, text: "cloves garlic" });
	});

	it("strips a leading approximate marker", () => {
		expect(parseIngredient("~1 tsp salt")).toEqual({ quantity: 1, unit: "tsp", text: "salt" });
	});

	it("returns null quantity for bare text", () => {
		expect(parseIngredient("salt to taste")).toEqual({ quantity: null, unit: null, text: "salt to taste" });
	});

	it("parses weight units", () => {
		expect(parseIngredient("200g chicken")).toEqual({ quantity: 200, unit: "g", text: "chicken" });
	});

	it("parses a two-word unit (fl oz)", () => {
		expect(parseIngredient("4 fl oz cream")).toEqual({ quantity: 4, unit: "fl oz", text: "cream" });
	});

	it("treats an unknown word after the number as part of the text", () => {
		const result = parseIngredient("3 medium carrots");
		expect(result.quantity).toBe(3);
		expect(result.unit).toBeNull();
		expect(result.text).toBe("medium carrots");
	});

	it("handles number glued directly to a unit (no space)", () => {
		expect(parseIngredient("100g butter")).toEqual({ quantity: 100, unit: "g", text: "butter" });
	});
});

// ─── formatQty ────────────────────────────────────────────────────────────────

describe("formatQty", () => {
	it("formats a whole number", () => {
		expect(formatQty(2)).toBe("2");
	});

	it("formats 0.5 as 1/2", () => {
		expect(formatQty(0.5)).toBe("1/2");
	});

	it("formats 0.25 as 1/4", () => {
		expect(formatQty(0.25)).toBe("1/4");
	});

	it("formats 1.5 as 1 1/2", () => {
		expect(formatQty(1.5)).toBe("1 1/2");
	});

	it("formats 2.75 as 2 3/4", () => {
		expect(formatQty(2.75)).toBe("2 3/4");
	});

	it("formats 0.33 as approximately 1/3", () => {
		expect(formatQty(1 / 3)).toBe("1/3");
	});

	it("formats 0.67 as approximately 2/3", () => {
		expect(formatQty(2 / 3)).toBe("2/3");
	});

	it("formats 0.125 as 1/8", () => {
		expect(formatQty(0.125)).toBe("1/8");
	});

	it("rounds near-whole fractions up when fractional part exceeds 0.99", () => {
		expect(formatQty(1.999)).toBe("2");
	});
});

// ─── assignCategory ───────────────────────────────────────────────────────────

describe("assignCategory", () => {
	const categories = [
		{ name: "Dairy", keywords: ["milk", "butter", "cream", "cheese"] },
		{ name: "Produce", keywords: ["carrot", "onion", "garlic"] },
	];

	it("matches a keyword exactly", () => {
		expect(assignCategory("milk", categories)).toBe("Dairy");
	});

	it("matches a keyword as a substring", () => {
		expect(assignCategory("heavy cream", categories)).toBe("Dairy");
	});

	it("matches case-insensitively", () => {
		expect(assignCategory("BUTTER", categories)).toBe("Dairy");
	});

	it("returns Uncategorized when no keyword matches", () => {
		expect(assignCategory("lemon juice", categories)).toBe("Uncategorized");
	});

	it("returns Uncategorized when category list is empty", () => {
		expect(assignCategory("milk", [])).toBe("Uncategorized");
	});

	it("matches the first category when multiple would match", () => {
		const overlap = [
			{ name: "First", keywords: ["cream"] },
			{ name: "Second", keywords: ["cream"] },
		];
		expect(assignCategory("cream", overlap)).toBe("First");
	});
});

// ─── aggregateItems ───────────────────────────────────────────────────────────

describe("aggregateItems", () => {
	it("sums items with the same name and same unit", () => {
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("milk", 0.5, "cups"),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(1.5);
		expect(result[0]!.unit).toBe("cups");
	});

	it("converts and sums items with different but compatible volume units", () => {
		// 1 cup + 1 cup (via 16 tbsp) = 2 cups
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("milk", 16, "tbsp"),
		]);
		expect(result).toHaveLength(1);
		// 1 cup = 236.59ml, 16 tbsp = 16 * 14.79 = 236.64ml ≈ 473ml ≈ 2 cups
		expect(result[0]!.unit).toBe("cups");
		expect(result[0]!.quantity).toBeCloseTo(2, 0);
	});

	it("converts and sums items with different weight units", () => {
		// 500g + 0.5kg = 1kg
		const result = aggregateItems(
			[item("flour", 500, "g"), item("flour", 0.5, "kg")],
			{ preferredWeightUnit: "kg" },
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.unit).toBe("kg");
		expect(result[0]!.quantity).toBe(1);
	});

	it("keeps volume and weight items separate for the same ingredient", () => {
		const result = aggregateItems([
			item("flour", 2, "cups"),
			item("flour", 200, "g"),
		]);
		expect(result).toHaveLength(2);
	});

	it("aggregates items with no unit by name", () => {
		const result = aggregateItems([
			item("eggs", 2, null),
			item("eggs", 3, null),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(5);
		expect(result[0]!.unit).toBeNull();
	});

	it("treats items with different names as separate entries", () => {
		const result = aggregateItems([
			item("milk", 1, "cups"),
			item("cream", 1, "cups"),
		]);
		expect(result).toHaveLength(2);
	});

	it("merges recipeTitle into a comma-separated string", () => {
		const result = aggregateItems([
			item("milk", 1, "cups", { recipeTitle: "Pancakes" }),
			item("milk", 1, "cups", { recipeTitle: "Waffles" }),
		]);
		expect(result[0]!.recipeTitle).toBe("Pancakes, Waffles");
	});

	it("keeps the existing quantity when a second unitless item has null quantity", () => {
		// Both items have no unit so they share the same aggregation key
		const result = aggregateItems([
			item("salt", 1, null),
			item("salt", null, null),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]!.quantity).toBe(1);
	});
});

// ─── isIgnored ────────────────────────────────────────────────────────────────

describe("isIgnored", () => {
	it("ignores a file that exactly matches an ignore path", () => {
		expect(isIgnored("Templates/Recipe.md", ["Templates/Recipe.md"])).toBe(true);
	});

	it("ignores a file inside an ignored folder", () => {
		expect(isIgnored("Templates/Recipe.md", ["Templates"])).toBe(true);
	});

	it("ignores a nested file inside an ignored folder", () => {
		expect(isIgnored("Archive/2024/Soup.md", ["Archive"])).toBe(true);
	});

	it("does not ignore a file whose path only starts with the folder name as a prefix", () => {
		// "Template" should not match "Templates/Recipe.md"
		expect(isIgnored("Templates/Recipe.md", ["Template"])).toBe(false);
	});

	it("does not ignore a file outside the ignored folder", () => {
		expect(isIgnored("Recipes/Soup.md", ["Templates"])).toBe(false);
	});

	it("handles a trailing slash on the ignore path", () => {
		expect(isIgnored("Templates/Recipe.md", ["Templates/"])).toBe(true);
	});

	it("returns false when ignorePaths is empty", () => {
		expect(isIgnored("Recipes/Soup.md", [])).toBe(false);
	});

	it("skips blank entries in ignorePaths", () => {
		expect(isIgnored("Recipes/Soup.md", ["", "  "])).toBe(false);
	});

	it("ignores a file when one of multiple ignore paths matches", () => {
		expect(isIgnored("Archive/Old.md", ["Templates", "Archive"])).toBe(true);
	});
});

// ─── getRecipes ───────────────────────────────────────────────────────────────

describe("getRecipes", () => {
	beforeEach(() => clearIngredientCache());

	it("returns files tagged #recipe in frontmatter tags array", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"] },
			},
		]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.title).toBe("Soup");
		expect(recipes[0]!.path).toBe("Recipes/Soup.md");
	});

	it("returns files tagged with inline #recipe tag", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup" },
				inlineTags: ["#recipe"],
			},
		]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(1);
	});

	it("accepts frontmatter tag string (not array)", async () => {
		const app = makeApp([
			{
				path: "Recipes/Pasta.md",
				frontmatter: { title: "Pasta", tags: "recipe" },
			},
		]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(1);
	});

	it("skips files with no frontmatter", async () => {
		const app = makeApp([{ path: "Notes/Ideas.md" }]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(0);
	});

	it("skips files without the recipe tag", async () => {
		const app = makeApp([
			{ path: "Notes/Ideas.md", frontmatter: { title: "Ideas", tags: ["note"] } },
		]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(0);
	});

	it("sets cook_soon from the configured property", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"], "make-soon": true },
			},
		]);
		const [r] = await getRecipes(app, "make-soon");
		expect(r!.cook_soon).toBe(true);
	});

	it("falls back to file basename when title is absent", async () => {
		const app = makeApp([
			{ path: "Recipes/Tasty Soup.md", frontmatter: { tags: ["recipe"] } },
		]);
		const [r] = await getRecipes(app);
		expect(r!.title).toBe("Tasty Soup");
	});

	it("excludes files matching ignorePaths", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Templates/Recipe Template.md", frontmatter: { title: "Template", tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", ["Templates"]);
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.path).toBe("Recipes/Soup.md");
	});

	it("restricts results to the configured recipesFolder", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Other/Pasta.md", frontmatter: { title: "Pasta", tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], "Recipes");
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.path).toBe("Recipes/Soup.md");
	});

	it("treats recipesFolder '.' as no folder restriction", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Other/Pasta.md", frontmatter: { title: "Pasta", tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], ".");
		expect(recipes).toHaveLength(2);
	});

	it("uses a custom recipesTag to find recipes", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Meals/Pasta.md", frontmatter: { title: "Pasta", tags: ["meal"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], undefined, "#meal");
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.path).toBe("Meals/Pasta.md");
	});

	it("normalizes recipesTag that lacks the leading #", async () => {
		const app = makeApp([
			{ path: "Meals/Pasta.md", frontmatter: { title: "Pasta", tags: ["meal"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], undefined, "meal");
		expect(recipes).toHaveLength(1);
	});
});

// ─── flushCookSoon ────────────────────────────────────────────────────────────

describe("flushCookSoon", () => {
	it("writes cook_soon back to the frontmatter property", async () => {
		const frontmatter: Record<string, unknown> = { title: "Soup", tags: ["recipe"], "cook-soon": false };
		const app = makeApp([{ path: "Recipes/Soup.md", frontmatter }]);
		const recipe = { path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 1, title: "Soup", __tags: [] };
		await flushCookSoon(recipe, app);
		expect(frontmatter["cook-soon"]).toBe(true);
	});

	it("uses the configured cookSoonProp key", async () => {
		const frontmatter: Record<string, unknown> = { title: "Soup", tags: ["recipe"], "make-soon": false };
		const app = makeApp([{ path: "Recipes/Soup.md", frontmatter }]);
		const recipe = { path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 1, title: "Soup", __tags: [] };
		await flushCookSoon(recipe, app, "make-soon");
		expect(frontmatter["make-soon"]).toBe(true);
		expect(frontmatter["cook-soon"]).toBeUndefined();
	});

	it("returns early when the file does not exist", async () => {
		const app = makeApp([]);
		const recipe = { path: "Missing/Recipe.md", cook_soon: true, cook_multiplier: 1, title: "X", __tags: [] };
		await expect(flushCookSoon(recipe, app)).resolves.toBeUndefined();
	});
});

// ─── applyToggleCookSoon ──────────────────────────────────────────────────────

describe("applyToggleCookSoon", () => {
	const baseRecipe = { path: "Recipes/Soup.md", cook_soon: false, cook_multiplier: 3, title: "Soup", __tags: [] };

	it("toggles cook_soon from false to true", () => {
		const store = writable([{ ...baseRecipe }]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		let recipes: typeof baseRecipe[] = [];
		store.subscribe((v) => { recipes = v; })();
		expect(recipes[0]!.cook_soon).toBe(true);
	});

	it("toggles cook_soon from true to false", () => {
		const store = writable([{ ...baseRecipe, cook_soon: true }]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		let recipes: typeof baseRecipe[] = [];
		store.subscribe((v) => { recipes = v; })();
		expect(recipes[0]!.cook_soon).toBe(false);
	});

	it("resets cook_multiplier to 1 on toggle", () => {
		const store = writable([{ ...baseRecipe, cook_soon: true, cook_multiplier: 3 }]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		let recipes: typeof baseRecipe[] = [];
		store.subscribe((v) => { recipes = v; })();
		expect(recipes[0]!.cook_multiplier).toBe(1);
	});

	it("leaves other recipes untouched", () => {
		const other = { path: "Recipes/Pasta.md", cook_soon: true, cook_multiplier: 2, title: "Pasta", __tags: [] };
		const store = writable([{ ...baseRecipe }, { ...other }]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		let recipes: typeof baseRecipe[] = [];
		store.subscribe((v) => { recipes = v; })();
		expect(recipes[1]!.cook_multiplier).toBe(2);
		expect(recipes[1]!.cook_soon).toBe(true);
	});
});

// ─── buildShoppingList ────────────────────────────────────────────────────────

describe("buildShoppingList", () => {
	const categories = [
		{ name: "Dairy", keywords: ["milk", "butter"] },
		{ name: "Produce", keywords: ["garlic", "onion"] },
	];

	beforeEach(() => clearIngredientCache());

	it("only includes recipes marked cook_soon", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"], "cook-soon": true },
				content: "## Ingredients\n- [ ] 2 cups milk\n- [ ] garlic\n",
			},
			{
				path: "Recipes/Salad.md",
				frontmatter: { title: "Salad", tags: ["recipe"], "cook-soon": false },
				content: "## Ingredients\n- [ ] 1 onion\n",
			},
		]);
		const recipes = [
			{ path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 1, title: "Soup", __tags: [] },
			{ path: "Recipes/Salad.md", cook_soon: false, cook_multiplier: 1, title: "Salad", __tags: [] },
		];
		const list = await buildShoppingList(app, recipes, categories);
		const texts = list.items.map((i) => i.text);
		expect(texts).toContain("milk");
		expect(texts).toContain("garlic");
		expect(texts).not.toContain("onion");
	});

	it("assigns ingredients to categories", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"] },
				content: "- [ ] 1 cup milk\n- [ ] garlic\n",
			},
		]);
		const recipes = [{ path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 1, title: "Soup", __tags: [] }];
		const list = await buildShoppingList(app, recipes, categories);
		const milkItem = list.items.find((i) => i.text === "milk");
		const garlicItem = list.items.find((i) => i.text === "garlic");
		expect(milkItem?.category).toBe("Dairy");
		expect(garlicItem?.category).toBe("Produce");
	});

	it("applies the cook_multiplier to quantities", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"] },
				content: "- [ ] 2 cups milk\n",
			},
		]);
		const recipes = [{ path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 3, title: "Soup", __tags: [] }];
		const list = await buildShoppingList(app, recipes, categories);
		const milkItem = list.items.find((i) => i.text === "milk");
		expect(milkItem?.quantity).toBe(6);
	});

	it("aggregates the same ingredient across multiple recipes", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { title: "Soup", tags: ["recipe"] },
				content: "- [ ] 1 cup milk\n",
			},
			{
				path: "Recipes/Cake.md",
				frontmatter: { title: "Cake", tags: ["recipe"] },
				content: "- [ ] 2 cups milk\n",
			},
		]);
		const recipes = [
			{ path: "Recipes/Soup.md", cook_soon: true, cook_multiplier: 1, title: "Soup", __tags: [] },
			{ path: "Recipes/Cake.md", cook_soon: true, cook_multiplier: 1, title: "Cake", __tags: [] },
		];
		const list = await buildShoppingList(app, recipes, categories);
		const milkItems = list.items.filter((i) => i.text === "milk");
		expect(milkItems).toHaveLength(1);
		expect(milkItems[0]!.quantity).toBe(3);
	});

	it("returns an empty items list when no recipes are cook_soon", async () => {
		const app = makeApp([]);
		const recipes = [{ path: "Recipes/Salad.md", cook_soon: false, cook_multiplier: 1, title: "Salad", __tags: [] }];
		const list = await buildShoppingList(app, recipes, categories);
		expect(list.items).toHaveLength(0);
	});

	it("includes category names in categoryOrder", async () => {
		const app = makeApp([]);
		const list = await buildShoppingList(app, [], categories);
		expect(list.categoryOrder).toContain("Dairy");
		expect(list.categoryOrder).toContain("Produce");
		expect(list.categoryOrder).toContain("Uncategorized");
	});

	it("sets generatedAt to a recent timestamp", async () => {
		const before = Date.now();
		const app = makeApp([]);
		const list = await buildShoppingList(app, [], categories);
		expect(list.generatedAt).toBeGreaterThanOrEqual(before);
		expect(list.generatedAt).toBeLessThanOrEqual(Date.now());
	});
});
