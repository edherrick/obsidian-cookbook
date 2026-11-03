import { describe, it, expect } from "vitest";
import { matchChoices, mergeKeywords, splitList } from "./host";

describe("mergeKeywords", () => {
	it("splits a pasted list on commas and new lines", () => {
		expect(mergeKeywords([], "carrot, onion\ngarlic,\n leek ")).toEqual(["carrot", "onion", "garlic", "leek"]);
	});

	it("appends after the existing keywords, keeping their order", () => {
		expect(mergeKeywords(["milk", "egg"], "butter")).toEqual(["milk", "egg", "butter"]);
	});

	it("skips keywords already present in any letter case", () => {
		expect(mergeKeywords(["Milk"], "milk, MILK, cream")).toEqual(["Milk", "cream"]);
	});

	it("skips repeats within the pasted text", () => {
		expect(mergeKeywords([], "salt, salt, pepper")).toEqual(["salt", "pepper"]);
	});

	it("ignores empty pieces", () => {
		expect(mergeKeywords(["salt"], " , ,\n\n")).toEqual(["salt"]);
	});
});

describe("splitList", () => {
	it("splits on commas and new lines and trims", () => {
		expect(splitList(" a ,b\n\nc, ")).toEqual(["a", "b", "c"]);
	});
});

describe("matchChoices", () => {
	const choices = ["Pantry", "Baking & Spices"];

	it("matches ignoring letter case, using the choice's spelling", () => {
		expect(matchChoices(["pantry", "BAKING & SPICES"], choices)).toEqual({
			matched: ["Pantry", "Baking & Spices"],
			unmatched: [],
		});
	});

	it("returns values that name no choice separately", () => {
		expect(matchChoices(["Pantry", "Pantri"], choices)).toEqual({ matched: ["Pantry"], unmatched: ["Pantri"] });
	});
});
