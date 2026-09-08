import { describe, it, expect } from "vitest";
import { buildShoppingList } from "./build";
import { makeApp, recipeFixture } from "../__mocks__/testHelpers";

const categories = [
	{ name: "Dairy", keywords: ["milk", "butter"] },
	{ name: "Produce", keywords: ["garlic", "onion"] },
];

describe("buildShoppingList", () => {
	it("only includes recipes marked cook_soon", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { tags: ["recipe"] },
				content: "## Ingredients\n- [ ] 2 cups milk\n- [ ] garlic\n",
			},
			{
				path: "Recipes/Salad.md",
				frontmatter: { tags: ["recipe"] },
				content: "## Ingredients\n- [ ] 1 onion\n",
			},
		]);
		const list = await buildShoppingList(
			app,
			[
				recipeFixture("Recipes/Soup.md", { cook_soon: true }),
				recipeFixture("Recipes/Salad.md", { cook_soon: false }),
			],
			categories,
		);
		const texts = list.items.map((i) => i.text);
		expect(texts).toContain("milk");
		expect(texts).toContain("garlic");
		expect(texts).not.toContain("onion");
	});

	it("assigns ingredients to categories", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { tags: ["recipe"] },
				content: "- [ ] 1 cup milk\n- [ ] garlic\n",
			},
		]);
		const list = await buildShoppingList(
			app,
			[recipeFixture("Recipes/Soup.md", { cook_soon: true })],
			categories,
		);
		expect(list.items.find((i) => i.text === "milk")?.category).toBe("Dairy");
		expect(list.items.find((i) => i.text === "garlic")?.category).toBe("Produce");
	});

	it("applies the cook_multiplier to quantities", async () => {
		const app = makeApp([
			{
				path: "Recipes/Soup.md",
				frontmatter: { tags: ["recipe"] },
				content: "- [ ] 2 cups milk\n",
			},
		]);
		const list = await buildShoppingList(
			app,
			[recipeFixture("Recipes/Soup.md", { cook_soon: true, cook_multiplier: 3 })],
			categories,
		);
		expect(list.items.find((i) => i.text === "milk")?.quantity).toBe(6);
	});

	it("aggregates the same ingredient across multiple recipes", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { tags: ["recipe"] }, content: "- [ ] 1 cup milk\n" },
			{ path: "Recipes/Cake.md", frontmatter: { tags: ["recipe"] }, content: "- [ ] 2 cups milk\n" },
		]);
		const list = await buildShoppingList(
			app,
			[
				recipeFixture("Recipes/Soup.md", { cook_soon: true }),
				recipeFixture("Recipes/Cake.md", { cook_soon: true }),
			],
			categories,
		);
		const milk = list.items.filter((i) => i.text === "milk");
		expect(milk).toHaveLength(1);
		expect(milk[0]!.quantity).toBe(3);
	});

	it("returns an empty items list when no recipes are cook_soon", async () => {
		const list = await buildShoppingList(
			makeApp([]),
			[recipeFixture("Recipes/Salad.md")],
			categories,
		);
		expect(list.items).toHaveLength(0);
	});

	it("includes category names in categoryOrder", async () => {
		const list = await buildShoppingList(makeApp([]), [], categories);
		expect(list.categoryOrder).toEqual(["Dairy", "Produce", "Uncategorized"]);
	});

	it("keeps a hand-sorted category order when regenerating", async () => {
		// Dragging Produce above Dairy used to be undone by the next generate
		const list = await buildShoppingList(makeApp([]), [], categories, {
			existingOrder: ["Produce", "Dairy", "Uncategorized"],
		});
		expect(list.categoryOrder).toEqual(["Produce", "Dairy", "Uncategorized"]);
	});

	it("appends newly configured categories to an existing order", async () => {
		const list = await buildShoppingList(makeApp([]), [], categories, {
			existingOrder: ["Produce", "Uncategorized"],
		});
		expect(list.categoryOrder).toEqual(["Produce", "Dairy", "Uncategorized"]);
	});

	it("always keeps Uncategorized last", async () => {
		const list = await buildShoppingList(makeApp([]), [], categories, {
			existingOrder: ["Uncategorized", "Produce"],
		});
		expect(list.categoryOrder[list.categoryOrder.length - 1]).toBe("Uncategorized");
	});

	it("sets generatedAt to a recent timestamp", async () => {
		const before = Date.now();
		const list = await buildShoppingList(makeApp([]), [], categories);
		expect(list.generatedAt).toBeGreaterThanOrEqual(before);
		expect(list.generatedAt).toBeLessThanOrEqual(Date.now());
	});

	it("survives a recipe file that cannot be read", async () => {
		const list = await buildShoppingList(
			makeApp([]),
			[recipeFixture("Missing/Recipe.md", { cook_soon: true })],
			categories,
		);
		expect(list.items).toHaveLength(0);
	});
});
