import { describe, it, expect } from "vitest";
import { checkRecipeContent, withTechniqueTags, withoutRepeatedWords } from "./check";
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

describe("restates-tag", () => {
	const tidy = (line: string) => {
		const parsed = parseIngredient(line.replace(/^- \[ \] /, ""));
		return withoutRepeatedWords(line, vocab.techniquesFor(parsed).techniques, vocab);
	};

	it("flags a note that repeats a word for its own tagged technique", () => {
		const issues = checkRecipeContent("- [ ] 6 cups broccoli florets | #prep/chop well chopped", vocab);
		expect(issues).toEqual([
			{
				line: 0,
				text: "- [ ] 6 cups broccoli florets | #prep/chop well chopped",
				kind: "restates-tag",
				techniques: ["chop"],
				fixed: "- [ ] 6 cups broccoli florets | #prep/chop well",
			},
		]);
	});

	it("leaves words for techniques the line isn't tagged with", () => {
		expect(checkRecipeContent("- [ ] 2 carrots | #prep/slice chopped small", vocab)).toEqual([]);
		expect(checkRecipeContent("- [ ] 1 cup basil | #prep/slice optional", vocab)).toEqual([]);
	});

	it("takes out only the repeated words, keeping the rest as written", () => {
		expect(tidy("- [ ] parmesan cheese | #prep/grate freshly grated").line).toBe("- [ ] parmesan cheese | #prep/grate freshly");
		expect(tidy("- [ ] 1 can butter beans | #prep/rinse drained and rinsed").line).toBe("- [ ] 1 can butter beans | #prep/rinse");
		expect(tidy("- [ ] 6 garlic cloves | #prep/chop smashed and chopped").line).toBe("- [ ] 6 garlic cloves | #prep/chop smashed");
		expect(tidy("- [ ] 2 carrots | #prep/peel #prep/slice peeled, thinly sliced, on the bias").line).toBe(
			"- [ ] 2 carrots | #prep/peel #prep/slice thinly, on the bias",
		);
	});

	it("leaves a word that's doing other work in a longer phrase", () => {
		for (const line of [
			"- [ ] 1 red onion | #prep/slice cut into 1-inch strips",
			"- [ ] 1 lb cucumbers | #prep/seed #prep/chop seeds optional, bite-size pieces",
			"- [ ] 2 scallions | #prep/slice trimmed, then sliced crosswise 1/4-inch thick",
		]) {
			expect(checkRecipeContent(line, vocab)).toEqual([]);
		}
	});

	it("tidies a comma note left by Add tags", () => {
		expect(tidy("- [ ] 4 garlic cloves, minced #prep/mince").line).toBe("- [ ] 4 garlic cloves #prep/mince");
	});

	it("never touches the ingredient name or the tags", () => {
		expect(tidy("- [ ] 1 cup chopped walnuts | #prep/chop").techniques).toEqual([]);
	});
});
