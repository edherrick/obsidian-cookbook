import { describe, it, expect } from "vitest";
import { Vocabulary, singularKey } from "./vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";

const vocab = new Vocabulary(DEFAULT_SETTINGS);

describe("singularKey", () => {
	it("folds common plurals", () => {
		expect(singularKey("red apples")).toBe("red apple");
		expect(singularKey("tomatoes")).toBe("tomato");
		expect(singularKey("berries")).toBe("berry");
	});

	it("leaves -ss, -us and -is words", () => {
		expect(singularKey("hummus")).toBe("hummus");
		expect(singularKey("swiss chard")).toBe("swiss chard");
	});

	it("is only a key: odd folds are fine as long as both forms agree", () => {
		expect(singularKey("molasses")).toBe(singularKey("molasses"));
		expect(singularKey("peas")).toBe(singularKey("pea"));
	});
});

describe("Vocabulary — ingredients", () => {
	it("maps an alias onto its canonical name", () => {
		expect(vocab.canonicalText("green onions")).toBe("scallion");
		expect(vocab.ingredientKey("2 spring onions".replace(/^\d+ /, ""))).toBe("scallion");
	});

	it("keys singular and plural lines together", () => {
		expect(vocab.ingredientKey("red apples")).toBe(vocab.ingredientKey("large red apple"));
	});

	it("matches aliases exactly, not as substrings", () => {
		expect(vocab.canonicalText("green onion dip")).toBe("green onion dip");
	});

	it("recognises staples by whole word", () => {
		expect(vocab.isStaple("kosher salt")).toBe(true);
		expect(vocab.isStaple("ground black pepper")).toBe(true);
		expect(vocab.isStaple("red bell pepper")).toBe(false);
		expect(vocab.isStaple("dried thyme")).toBe(true);
		expect(vocab.isStaple("fresh thyme leaves")).toBe(false);
	});
});

describe("Vocabulary — techniques", () => {
	it("reads tags, in prep order", () => {
		const parsed = parseIngredient("2 cups squash | #prep/dice #prep/peel small");
		expect(vocab.techniquesFor(parsed)).toEqual({
			techniques: ["peel", "dice"],
			unknown: [],
			tagged: true,
		});
	});

	it("reports tags that name no technique", () => {
		const parsed = parseIngredient("1 onion | #prep/dicee");
		expect(vocab.techniquesFor(parsed).unknown).toEqual(["dicee"]);
	});

	it("falls back to prep words when a line has no tags", () => {
		expect(vocab.techniquesFor(parseIngredient("1 can beans, drained and rinsed")).techniques).toEqual([
			"rinse",
		]);
		expect(vocab.techniquesFor(parseIngredient("1 red onion | cut into 1-inch strips")).techniques).toEqual([
			"slice",
		]);
	});

	it("ignores tags under another prefix", () => {
		const parsed = parseIngredient("1 onion | #shop/costco diced");
		expect(vocab.techniquesFor(parsed)).toEqual({ techniques: ["dice"], unknown: [], tagged: false });
	});

	it("builds tags from the configured prefix", () => {
		const custom = new Vocabulary({ ...DEFAULT_SETTINGS, techniqueTagPrefix: "#knife/" });
		expect(custom.tagFor("dice")).toBe("#knife/dice");
	});
});
