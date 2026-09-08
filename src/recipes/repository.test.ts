import { describe, it, expect } from "vitest";
import { writable } from "svelte/store";
import {
	applySetMultiplier,
	applyToggleCookSoon,
	flushCookSoon,
	getRecipes,
	isIgnored,
} from "./repository";
import type { Recipe } from "./repository";
import { makeApp, recipeFixture } from "../__mocks__/testHelpers";

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

describe("getRecipes", () => {
	it("returns files tagged #recipe in frontmatter tags array", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.title).toBe("Soup");
		expect(recipes[0]!.path).toBe("Recipes/Soup.md");
	});

	it("returns files tagged with inline #recipe tag", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup" }, inlineTags: ["#recipe"] },
		]);
		expect(await getRecipes(app)).toHaveLength(1);
	});

	it("accepts a note tagged only inline, with no frontmatter at all", async () => {
		const app = makeApp([{ path: "Recipes/Soup.md", inlineTags: ["#recipe"] }]);
		const recipes = await getRecipes(app);
		expect(recipes).toHaveLength(1);
		expect(recipes[0]!.title).toBe("Soup");
	});

	it("accepts frontmatter tag string (not array)", async () => {
		const app = makeApp([
			{ path: "Recipes/Pasta.md", frontmatter: { title: "Pasta", tags: "recipe" } },
		]);
		expect(await getRecipes(app)).toHaveLength(1);
	});

	it("skips files with neither frontmatter nor tags", async () => {
		expect(await getRecipes(makeApp([{ path: "Notes/Ideas.md" }]))).toHaveLength(0);
	});

	it("skips files without the recipe tag", async () => {
		const app = makeApp([
			{ path: "Notes/Ideas.md", frontmatter: { title: "Ideas", tags: ["note"] } },
		]);
		expect(await getRecipes(app)).toHaveLength(0);
	});

	it("skips non-markdown files", async () => {
		const app = makeApp([
			{ path: "Recipes/cover.png", frontmatter: { tags: ["recipe"] } },
			{ path: "Recipes/Soup.md", frontmatter: { tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app);
		expect(recipes.map((r) => r.path)).toEqual(["Recipes/Soup.md"]);
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
		const app = makeApp([{ path: "Recipes/Tasty Soup.md", frontmatter: { tags: ["recipe"] } }]);
		const [r] = await getRecipes(app);
		expect(r!.title).toBe("Tasty Soup");
	});

	it("excludes files matching ignorePaths", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{
				path: "Templates/Recipe Template.md",
				frontmatter: { title: "Template", tags: ["recipe"] },
			},
		]);
		const recipes = await getRecipes(app, "cook-soon", ["Templates"]);
		expect(recipes.map((r) => r.path)).toEqual(["Recipes/Soup.md"]);
	});

	it("restricts results to the configured recipesFolder", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Other/Pasta.md", frontmatter: { title: "Pasta", tags: ["recipe"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], "Recipes");
		expect(recipes.map((r) => r.path)).toEqual(["Recipes/Soup.md"]);
	});

	it("treats recipesFolder '.' as no folder restriction", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Other/Pasta.md", frontmatter: { title: "Pasta", tags: ["recipe"] } },
		]);
		expect(await getRecipes(app, "cook-soon", [], ".")).toHaveLength(2);
	});

	it("uses a custom recipesTag to find recipes", async () => {
		const app = makeApp([
			{ path: "Recipes/Soup.md", frontmatter: { title: "Soup", tags: ["recipe"] } },
			{ path: "Meals/Pasta.md", frontmatter: { title: "Pasta", tags: ["meal"] } },
		]);
		const recipes = await getRecipes(app, "cook-soon", [], undefined, "#meal");
		expect(recipes.map((r) => r.path)).toEqual(["Meals/Pasta.md"]);
	});

	it("normalizes recipesTag that lacks the leading #", async () => {
		const app = makeApp([
			{ path: "Meals/Pasta.md", frontmatter: { title: "Pasta", tags: ["meal"] } },
		]);
		expect(await getRecipes(app, "cook-soon", [], undefined, "meal")).toHaveLength(1);
	});
});

describe("flushCookSoon", () => {
	it("writes cook_soon back to the frontmatter property", async () => {
		const frontmatter: Record<string, unknown> = { title: "Soup", "cook-soon": false };
		const app = makeApp([{ path: "Recipes/Soup.md", frontmatter }]);
		await flushCookSoon(recipeFixture("Recipes/Soup.md", { cook_soon: true }), app);
		expect(frontmatter["cook-soon"]).toBe(true);
	});

	it("uses the configured cookSoonProp key", async () => {
		const frontmatter: Record<string, unknown> = { title: "Soup", "make-soon": false };
		const app = makeApp([{ path: "Recipes/Soup.md", frontmatter }]);
		await flushCookSoon(recipeFixture("Recipes/Soup.md", { cook_soon: true }), app, "make-soon");
		expect(frontmatter["make-soon"]).toBe(true);
		expect(frontmatter["cook-soon"]).toBeUndefined();
	});

	it("returns early when the file does not exist", async () => {
		await expect(
			flushCookSoon(recipeFixture("Missing/Recipe.md", { cook_soon: true }), makeApp([])),
		).resolves.toBeUndefined();
	});
});

function read(store: ReturnType<typeof writable<Recipe[]>>): Recipe[] {
	let value: Recipe[] = [];
	store.subscribe((v) => {
		value = v;
	})();
	return value;
}

describe("applyToggleCookSoon", () => {
	it("toggles cook_soon from false to true", () => {
		const store = writable<Recipe[]>([recipeFixture("Recipes/Soup.md")]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		expect(read(store)[0]!.cook_soon).toBe(true);
	});

	it("toggles cook_soon from true to false", () => {
		const store = writable<Recipe[]>([recipeFixture("Recipes/Soup.md", { cook_soon: true })]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		expect(read(store)[0]!.cook_soon).toBe(false);
	});

	it("preserves cook_multiplier across a toggle", () => {
		// Un-toggling and re-toggling used to silently reset a ×3 back to ×1
		const store = writable<Recipe[]>([
			recipeFixture("Recipes/Soup.md", { cook_soon: true, cook_multiplier: 3 }),
		]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		expect(read(store)[0]!.cook_multiplier).toBe(3);
		expect(read(store)[0]!.cook_soon).toBe(true);
	});

	it("leaves other recipes untouched", () => {
		const store = writable<Recipe[]>([
			recipeFixture("Recipes/Soup.md"),
			recipeFixture("Recipes/Pasta.md", { cook_soon: true, cook_multiplier: 2 }),
		]);
		applyToggleCookSoon(store, "Recipes/Soup.md", makeApp([]), "cook-soon");
		expect(read(store)[1]!.cook_multiplier).toBe(2);
		expect(read(store)[1]!.cook_soon).toBe(true);
	});
});

describe("applySetMultiplier", () => {
	it("sets the multiplier on the matching recipe only", () => {
		const store = writable<Recipe[]>([
			recipeFixture("Recipes/Soup.md"),
			recipeFixture("Recipes/Pasta.md"),
		]);
		applySetMultiplier(store, "Recipes/Soup.md", 4);
		expect(read(store)[0]!.cook_multiplier).toBe(4);
		expect(read(store)[1]!.cook_multiplier).toBe(1);
	});
});
