import { describe, it, expect } from "vitest";
import { recipeIndexes, splitDone } from "./display";

const titles = [
	"Gnocchi with Sausage & Broccoli",
	"Sun-Dried Tomato, Sausage, and Butter Bean Skillet",
	"Breakfast Burritos",
];

describe("recipeIndexes", () => {
	it("finds every recipe in a joined source, commas and all", () => {
		expect(recipeIndexes("Sun-Dried Tomato, Sausage, and Butter Bean Skillet, Breakfast Burritos", titles)).toEqual([1, 2]);
	});

	it("finds a single recipe", () => {
		expect(recipeIndexes("Gnocchi with Sausage & Broccoli", titles)).toEqual([0]);
	});

	it("is empty for a typed-in item or an unknown recipe", () => {
		expect(recipeIndexes(undefined, titles)).toEqual([]);
		expect(recipeIndexes("Some Other Recipe", titles)).toEqual([]);
	});

	it("doesn't count a title found inside a longer one", () => {
		expect(recipeIndexes("Breakfast Burritos Deluxe", ["Breakfast Burritos", "Breakfast Burritos Deluxe"])).toEqual([1]);
	});
});

describe("splitDone", () => {
	it("keeps order within checked and unchecked", () => {
		const items = [
			{ id: "a", checked: true },
			{ id: "b", checked: false },
			{ id: "c", checked: true },
			{ id: "d", checked: false },
		];
		const { todo, done } = splitDone(items);
		expect(todo.map((i) => i.id)).toEqual(["b", "d"]);
		expect(done.map((i) => i.id)).toEqual(["a", "c"]);
	});
});
