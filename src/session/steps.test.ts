import { describe, it, expect } from "vitest";
import { splitStepBlocks } from "./steps";
import type { SessionRecipe } from "./build";

function recipe(body: string): SessionRecipe {
	return { path: "recipes/Oats.md", title: "Oats", content: `---\ntags: [recipe]\n---\n${body}`, ingredients: [] };
}

const oats = recipe(`![](cover)

---
## Ingredients
- [ ] neutral oil spray

## Directions
Preheat the oven to 350ºF. Spray the dish.

---
**Crumble topping**
- [ ] 3/4 cup rolled oats
- [ ] 1/2 cup pepitas | #prep/chop

Mix the topping. Chill until ready.

---

---
- [ ] 2 cups Greek yogurt, for serving

---
## Store it
Fridge 4 days.
`);

describe("splitStepBlocks", () => {
	const blocks = splitStepBlocks(oats);

	it("splits on rules and skips empty blocks", () => {
		expect(blocks).toHaveLength(3);
		expect(blocks.map((b) => b.ref)).toEqual(["recipes/Oats.md#1", "recipes/Oats.md#2", "recipes/Oats.md#3"]);
		expect(blocks.every((b) => b.total === 3)).toBe(true);
	});

	it("keeps the block's ingredients and directions, without the section headings", () => {
		expect(blocks[1]!.text).toBe(
			"**Crumble topping**\n- [ ] 3/4 cup rolled oats\n- [ ] 1/2 cup pepitas | #prep/chop\n\nMix the topping. Chill until ready.",
		);
		expect(blocks[0]!.text).not.toContain("## Directions");
	});

	it("summarizes with the first sentence, or the ingredients when there is no prose", () => {
		expect(blocks[0]!.summary).toBe("Preheat the oven to 350ºF.");
		expect(blocks[1]!.summary).toBe("Mix the topping.");
		expect(blocks[2]!.summary).toBe("2 cups Greek yogurt, for serving");
	});
});
