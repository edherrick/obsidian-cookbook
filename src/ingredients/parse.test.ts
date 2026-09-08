import { describe, it, expect } from "vitest";
import { parseChecklistItems, parseIngredient } from "./parse";

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
		expect(parseIngredient("7-8 Tbsp soy sauce")).toEqual({
			quantity: 7,
			unit: "tbsp",
			text: "soy sauce",
		});
	});

	it("takes the lower bound of a mixed-number range", () => {
		// "1 1/2 - 2 cups fresh basil leaves" used to leave "- 2 cups" in the name
		expect(parseIngredient("1 1/2 - 2 cups fresh basil leaves")).toEqual({
			quantity: 1.5,
			unit: "cups",
			text: "fresh basil leaves",
		});
	});

	it("strips a leading approximate marker", () => {
		expect(parseIngredient("~1 tsp salt")).toEqual({ quantity: 1, unit: "tsp", text: "salt" });
	});

	it("returns null quantity for bare text", () => {
		expect(parseIngredient("salt to taste")).toEqual({
			quantity: null,
			unit: null,
			text: "salt to taste",
		});
	});

	it("parses weight units", () => {
		expect(parseIngredient("200g chicken")).toEqual({ quantity: 200, unit: "g", text: "chicken" });
	});

	it("parses a two-word unit (fl oz)", () => {
		expect(parseIngredient("4 fl oz cream")).toEqual({ quantity: 4, unit: "fl oz", text: "cream" });
	});

	it("treats an unknown word after the number as part of the text", () => {
		expect(parseIngredient("3 medium carrots")).toEqual({
			quantity: 3,
			unit: null,
			text: "medium carrots",
		});
	});

	it("handles number glued directly to a unit (no space)", () => {
		expect(parseIngredient("100g butter")).toEqual({ quantity: 100, unit: "g", text: "butter" });
	});

	it("tolerates an abbreviation period on the unit", () => {
		expect(parseIngredient("6 Tbsp. butter")).toEqual({
			quantity: 6,
			unit: "tbsp",
			text: "butter",
		});
	});

	it("skips a size aside between the quantity and the unit", () => {
		expect(parseIngredient("1 (14-ounce) can full-fat coconut milk")).toEqual({
			quantity: 1,
			unit: "can",
			text: "full-fat coconut milk",
		});
	});

	it("lifts a leading count unit out of the name", () => {
		expect(parseIngredient("2-3 cloves garlic")).toEqual({
			quantity: 2,
			unit: "cloves",
			text: "garlic",
		});
	});

	it("lifts a trailing count unit out of the name", () => {
		expect(parseIngredient("4 garlic cloves")).toEqual({
			quantity: 4,
			unit: "cloves",
			text: "garlic",
		});
	});

	it("drops filler after a count unit", () => {
		expect(parseIngredient("1 stick of butter")).toEqual({
			quantity: 1,
			unit: "stick",
			text: "butter",
		});
	});
});

describe("parseIngredient — prep clauses", () => {
	it("splits on an explicit pipe", () => {
		expect(parseIngredient("1 large red onion | cut into 1-inch strips")).toEqual({
			quantity: 1,
			unit: null,
			text: "large red onion",
			prep: "cut into 1-inch strips",
		});
	});

	it("splits a trailing comma clause that starts with a prep verb", () => {
		expect(parseIngredient("4 garlic cloves, chopped")).toEqual({
			quantity: 4,
			unit: "cloves",
			text: "garlic",
			prep: "chopped",
		});
	});

	it("splits 'to taste'", () => {
		expect(parseIngredient("7-8 Tbsp soy sauce, to taste").prep).toBe("to taste");
	});

	it("splits 'or to taste'", () => {
		expect(parseIngredient("1/8 tsp crushed red pepper, or to taste").prep).toBe("or to taste");
	});

	it("splits 'divided'", () => {
		expect(parseIngredient("2 1/2 cups shredded Cheddar cheese, divided")).toEqual({
			quantity: 2.5,
			unit: "cups",
			text: "shredded Cheddar cheese",
			prep: "divided",
		});
	});

	it("does NOT split a comma that separates two descriptors", () => {
		// "skinless chicken breasts" is not a preparation instruction
		expect(parseIngredient("1 1/2 lbs boneless, skinless chicken breasts")).toEqual({
			quantity: 1.5,
			unit: "lbs",
			text: "boneless, skinless chicken breasts",
		});
	});
});

describe("parseChecklistItems", () => {
	it("reads every checkbox line, checked or not", () => {
		const items = parseChecklistItems(
			"## Ingredients\n- [ ] 2 cups flour\n- [x] 1 tsp salt\n\nSome prose.\n* [ ] 3 eggs\n",
		);
		expect(items.map((i) => i.text)).toEqual(["flour", "salt", "eggs"]);
	});

	it("ignores non-checkbox lines", () => {
		expect(parseChecklistItems("- just a bullet\nplain text\n")).toHaveLength(0);
	});
});

describe("parseIngredient — prep verbs seen in real notes", () => {
	const cases: [string, string, string][] = [
		["3 large garlic cloves, smashed and chopped", "large garlic", "smashed and chopped"],
		["2 cups flour, sifted", "flour", "sifted"],
		["1 cup almonds, toasted", "almonds", "toasted"],
		["1 lb spinach, thawed", "spinach", "thawed"],
		["2 oz parmesan, shaved", "parmesan", "shaved"],
	];

	for (const [raw, text, prep] of cases) {
		it(`splits "${prep}" off ${raw}`, () => {
			const parsed = parseIngredient(raw);
			expect(parsed.text).toBe(text);
			expect(parsed.prep).toBe(prep);
		});
	}
});
