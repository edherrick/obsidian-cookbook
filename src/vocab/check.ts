import type { Vocabulary } from "./vocabulary";
import { parseIngredient } from "../ingredients/parse";

export interface VocabularyIssue {
	/** 0-based line number in the file. */
	line: number;
	/** The line as written, to show and to re-check before a fix is applied. */
	text: string;
	kind: "unknown-tag" | "untagged";
	/** Unknown tag names, or the techniques an untagged line should carry. */
	techniques: string[];
}

const CHECKBOX_RE = /^[ \t]*[-*]\s*\[[ xX]?\]\s*(.+)$/;

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lines that break the technique-tag convention: tags naming no known
 * technique (usually typos), and ingredient lines whose prep words describe a
 * technique without tagging it. Frontmatter and code blocks are skipped.
 */
export function checkRecipeContent(content: string, vocab: Vocabulary): VocabularyIssue[] {
	const lines = content.split("\n");
	const tagRe = new RegExp(`(?:^|\\s)#${escapeRegex(vocab.prefix)}/([\\w-]+)`, "gi");
	const known = new Set(vocab.techniqueNames().map((n) => n.toLowerCase()));
	const issues: VocabularyIssue[] = [];

	let i = 0;
	if (lines[0]?.trim() === "---") {
		const end = lines.findIndex((l, idx) => idx > 0 && l.trim() === "---");
		i = end === -1 ? 0 : end + 1;
	}

	let inFence = false;
	for (; i < lines.length; i++) {
		const line = lines[i]!;
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const unknown = [...line.matchAll(tagRe)]
			.map((m) => m[1]!.toLowerCase())
			.filter((t) => !known.has(t));
		if (unknown.length > 0) {
			issues.push({ line: i, text: line, kind: "unknown-tag", techniques: [...new Set(unknown)] });
			continue;
		}

		const checkbox = CHECKBOX_RE.exec(line);
		if (!checkbox) continue;
		const match = vocab.techniquesFor(parseIngredient(checkbox[1]!.trim()));
		if (!match.tagged && match.techniques.length > 0) {
			issues.push({ line: i, text: line, kind: "untagged", techniques: match.techniques });
		}
	}
	return issues;
}

/** The line with its techniques tagged. The parser reads tags anywhere on a line. */
export function withTechniqueTags(line: string, techniques: string[], vocab: Vocabulary): string {
	const tags = techniques.map((t) => vocab.tagFor(t)).join(" ");
	return `${line.trimEnd()} ${tags}`;
}
