import { describe, it, expect } from "vitest";
import { checkRecipeContent, withTechniqueTags } from "./check";
import { Vocabulary } from "./vocabulary";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { parseIngredient } from "../ingredients/parse";

const vocab = new Vocabulary(DEFAULT_SETTINGS);

const note = `---
tags:
  - recipe
note: "#prep/ignored in frontmatter"
---
## Ingredients
- [ ] 1 onion | #prep/dicee
- [ ] 4 garlic cloves, minced
- [ ] 1 shallot | #prep/mince
- [ ] 1 cup flour

\`\`\`
- [ ] 1 carrot, chopped
\`\`\`

Then #prep/sautee the onion.

Write \`#prep/technique\` after the pipe.
`;

describe("checkRecipeContent", () => {
	const issues = checkRecipeContent(note, vocab);

	it("flags unknown technique tags, in ingredients and directions", () => {
		const unknown = issues.filter((i) => i.kind === "unknown-tag");
		expect(unknown.map((i) => i.techniques)).toEqual([["dicee"], ["sautee"]]);
		expect(unknown[0]!.line).toBe(6);
	});

	it("flags untagged prep words with the tags they should carry", () => {
		const untagged = issues.filter((i) => i.kind === "untagged");
		expect(untagged).toEqual([
			{ line: 7, text: "- [ ] 4 garlic cloves, minced", kind: "untagged", techniques: ["mince"] },
		]);
	});

	it("skips frontmatter, code blocks and inline code", () => {
		expect(issues.some((i) => i.text.includes("after the pipe"))).toBe(false);
		expect(issues.some((i) => i.text.includes("ignored"))).toBe(false);
		expect(issues.some((i) => i.text.includes("carrot"))).toBe(false);
	});
});

describe("withTechniqueTags", () => {
	it("appends tags that the parser then reads", () => {
		const fixed = withTechniqueTags("- [ ] 4 garlic cloves, minced", ["mince"], vocab);
		expect(fixed).toBe("- [ ] 4 garlic cloves, minced #prep/mince");
		const parsed = parseIngredient(fixed.replace(/^- \[ \] /, ""));
		expect(vocab.techniquesFor(parsed).tagged).toBe(true);
		expect(parsed.text).toBe("garlic");
	});
});
