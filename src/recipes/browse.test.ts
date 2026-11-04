import { describe, it, expect } from "vitest";
import { cardMeta, formatMinutes, isUntried, matchesQuickFilter, mealTypes, NO_QUICK_FILTER } from "./browse";

const thai = {
	title: "Thai Basil Chicken",
	"prep-time": 10,
	"cook-time": 20,
	rating: 5,
	cuisine: "Asian",
	"meal-type": ["Dinner"],
	tried: true,
	cook_soon: false,
	"serving-size": 4,
	source: "Pam HR",
};
const gnocchi = { title: "Gnocchi", "cook-time": 35, rating: 4, cuisine: "Italian", "meal-type": ["Dinner", "One-Pan"], tried: null, cook_soon: true };
const oats = { title: "Apple Crisp Baked Oats", "meal-type": ["Breakfast"], tried: false, cook_soon: false };

describe("formatMinutes", () => {
	it("reads as minutes and hours", () => {
		expect(formatMinutes(45)).toBe("45 min");
		expect(formatMinutes(60)).toBe("1 h");
		expect(formatMinutes(75)).toBe("1 h 15 min");
	});
});

describe("cardMeta", () => {
	it("shows total time, rating and cuisine", () => {
		expect(cardMeta(thai)).toEqual(["30 min", "★ 5", "Asian"]);
	});

	it("skips what a recipe doesn't have", () => {
		expect(cardMeta(oats)).toEqual([]);
	});

	it("adds the extra properties chosen in settings, labelling bare numbers", () => {
		expect(cardMeta(thai, ["title", "cook-time", "source", "serving-size"])).toEqual([
			"30 min",
			"★ 5",
			"Asian",
			"Pam HR",
			"serving-size 4",
		]);
	});
});

describe("quick filters", () => {
	it("knows untried recipes", () => {
		expect(isUntried(thai)).toBe(false);
		expect(isUntried(gnocchi)).toBe(true);
		expect(isUntried({ title: "No tried property" })).toBe(false);
	});

	it("lists meal types, most used first", () => {
		expect(mealTypes([thai, gnocchi, oats])).toEqual(["Dinner", "Breakfast", "One-Pan"]);
	});

	it("searches title and cuisine", () => {
		const q = (query: string) => ({ ...NO_QUICK_FILTER, query });
		expect(matchesQuickFilter(thai, q("basil"))).toBe(true);
		expect(matchesQuickFilter(gnocchi, q("ital"))).toBe(true);
		expect(matchesQuickFilter(oats, q("basil"))).toBe(false);
	});

	it("combines toggles and meal types", () => {
		const f = { ...NO_QUICK_FILTER, cookSoon: true, mealTypes: ["Dinner", "Breakfast"] };
		expect([thai, gnocchi, oats].filter((r) => matchesQuickFilter(r, f)).map((r) => r.title)).toEqual(["Gnocchi"]);
		const untried = { ...NO_QUICK_FILTER, untried: true };
		expect([thai, gnocchi, oats].filter((r) => matchesQuickFilter(r, untried)).map((r) => r.title)).toEqual([
			"Gnocchi",
			"Apple Crisp Baked Oats",
		]);
	});
});
