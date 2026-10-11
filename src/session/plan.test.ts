import { describe, it, expect } from "vitest";
import { defaultPlan, outOfOrder, parsePlan, planSteps, serializePlan, toPlan } from "./plan";
import type { SessionRecipe } from "./build";

function recipe(path: string, steps: string[], extra: Partial<SessionRecipe> = {}): SessionRecipe {
	const content = `---\ntags: [recipe]\n---\n## Ingredients\n${steps.join("\n\n---\n")}\n`;
	return { path, title: path.replace(/\.md$/, ""), content, ingredients: [], ...extra };
}

const oats = recipe("Oats.md", ["Mix.", "Bake.", "Slice."], { ovenTemp: 350 });
const soup = recipe("Soup.md", ["Roast.", "Blend."], { ovenTemp: 400 });

describe("defaultPlan", () => {
	it("lists every step, recipe by recipe in cook order", () => {
		expect(defaultPlan([soup, oats]).map((e) => e.ref)).toEqual([
			"Oats.md#1",
			"Oats.md#2",
			"Oats.md#3",
			"Soup.md#1",
			"Soup.md#2",
		]);
	});
});

describe("planSteps", () => {
	it("keeps the saved order and meanwhile marks", () => {
		const steps = planSteps([oats, soup], [
			{ ref: "Oats.md#1", meanwhile: false },
			{ ref: "Oats.md#2", meanwhile: false },
			{ ref: "Soup.md#1", meanwhile: true },
		]);
		expect(toPlan(steps).slice(0, 3)).toEqual([
			{ ref: "Oats.md#1", meanwhile: false },
			{ ref: "Oats.md#2", meanwhile: false },
			{ ref: "Soup.md#1", meanwhile: true },
		]);
	});

	it("drops steps that no longer exist and appends new ones in default order", () => {
		const steps = planSteps([oats, soup], [
			{ ref: "Soup.md#2", meanwhile: false },
			{ ref: "Soup.md#9", meanwhile: false },
			{ ref: "Gone.md#1", meanwhile: false },
		]);
		expect(steps.map((s) => s.block.ref)).toEqual([
			"Soup.md#2",
			"Oats.md#1",
			"Oats.md#2",
			"Oats.md#3",
			"Soup.md#1",
		]);
	});

	it("turns a leading meanwhile step into a main step, and ignores duplicates", () => {
		const steps = planSteps([soup], [
			{ ref: "Soup.md#1", meanwhile: true },
			{ ref: "Soup.md#1", meanwhile: false },
		]);
		expect(toPlan(steps)).toEqual([
			{ ref: "Soup.md#1", meanwhile: false },
			{ ref: "Soup.md#2", meanwhile: false },
		]);
	});
});

describe("serializePlan / parsePlan", () => {
	it("round-trips through frontmatter strings", () => {
		const plan = [
			{ ref: "recipes/Oats, Apple.md#1", meanwhile: false },
			{ ref: "recipes/Soup.md#2", meanwhile: true },
		];
		expect(serializePlan(plan)).toEqual(["recipes/Oats, Apple.md#1", "meanwhile recipes/Soup.md#2"]);
		expect(parsePlan(serializePlan(plan))).toEqual(plan);
	});

	it("ignores anything that is not a list of strings", () => {
		expect(parsePlan(undefined)).toBeUndefined();
		expect(parsePlan("Oats.md#1")).toBeUndefined();
		expect(parsePlan(["Oats.md#1", 3, ""])).toEqual([{ ref: "Oats.md#1", meanwhile: false }]);
	});
});

describe("outOfOrder", () => {
	it("flags a step placed after a later step of its own recipe", () => {
		const steps = planSteps([oats], [
			{ ref: "Oats.md#2", meanwhile: false },
			{ ref: "Oats.md#1", meanwhile: false },
			{ ref: "Oats.md#3", meanwhile: false },
		]);
		expect([...outOfOrder(steps)]).toEqual([["Oats.md#1", 2]]);
	});
});
