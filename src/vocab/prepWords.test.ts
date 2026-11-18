import { describe, it, expect } from "vitest";
import { isPrepNote, unknownPrepPhrases } from "./prepWords";
import { Vocabulary } from "./vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";

const vocab = new Vocabulary(DEFAULT_SETTINGS);
const lines = (...ls: string[]) => ls.map((l) => parseIngredient(l));

describe("unknownPrepPhrases", () => {
	const phrases = unknownPrepPhrases(
		[
			["Pasta", lines("6 garlic cloves | #prep/chop smashed and chopped", "2 scallions, trimmed", "1 cup basil | #prep/slice optional")],
			["Stir-fry", lines("4 garlic cloves, smashed", "1 onion | #prep/slice cut into 1-inch strips", "2 carrots | #prep/dice 1/4-inch")],
		],
		vocab,
	);

	it("lists note pieces no technique knows on untagged lines", () => {
		expect(phrases).toEqual([
			{ phrase: "smashed", recipes: ["Stir-fry"] },
			{ phrase: "trimmed", recipes: ["Pasta"] },
		]);
	});

	it("skips tagged lines, whose words are never read", () => {
		const tagged = unknownPrepPhrases([["Pasta", lines("1 onion | #prep/chop finely", "2 carrots | #prep/dice small")]], vocab);
		expect(tagged).toEqual([]);
	});

	it("skips pieces a technique already knows, measurements and serving notes", () => {
		const all = phrases.map((p) => p.phrase);
		expect(all).not.toContain("chopped");
		expect(all).not.toContain("cut into 1-inch strips"); // "strips" is a slice word
		expect(all).not.toContain("optional");
		expect(all).not.toContain("1/4-inch");
	});

	it("stops listing a phrase once a technique has it as a word", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			techniques: [...DEFAULT_SETTINGS.techniques, { name: "crush", keywords: ["smashed"] }],
		};
		const again = unknownPrepPhrases([["Pasta", lines("4 garlic cloves, smashed")]], new Vocabulary(settings));
		expect(again).toEqual([]);
	});
});

describe("isPrepNote", () => {
	it("is false once every piece is a measurement, serving note or ignored", () => {
		const ignoring = new Vocabulary({ ...DEFAULT_SETTINGS, ignoredPrepPhrases: ["half of a 1-oz packet", "Soy sauce also works"] });
		expect(isPrepNote("half of a 1-oz packet", ignoring)).toBe(false);
		expect(isPrepNote("soy sauce also works", ignoring)).toBe(false);
		expect(isPrepNote("plus more for garnish", ignoring)).toBe(false);
		expect(isPrepNote("casings removed", ignoring)).toBe(true);
		expect(isPrepNote("half of a 1-oz packet", vocab)).toBe(true);
	});
});
