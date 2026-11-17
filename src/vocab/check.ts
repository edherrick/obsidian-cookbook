import type { Vocabulary } from "./vocabulary";
import { parseIngredient, separatorIndex } from "../ingredients/parse";
import { keywordSpans } from "../ingredients/categorize";

export interface VocabularyIssue {
	/** 0-based line number in the file. */
	line: number;
	/** The line as written, to show and to re-check before a fix is applied. */
	text: string;
	kind: "unknown-tag" | "untagged" | "restates-tag";
	/**
	 * Unknown tag names, the techniques an untagged line should carry, or the
	 * tagged techniques its note repeats.
	 */
	techniques: string[];
	/** For "restates-tag": the line with the repeated words taken out of its note. */
	fixed?: string;
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

		// Obsidian doesn't read tags inside inline code, so neither does the check
		const prose = line.replace(/`[^`]*`/g, " ");
		const unknown = [...prose.matchAll(tagRe)]
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
		} else if (match.tagged && match.techniques.length > 0) {
			const tidy = withoutRepeatedWords(line, match.techniques, vocab);
			if (tidy.techniques.length > 0) {
				issues.push({ line: i, text: line, kind: "restates-tag", techniques: tidy.techniques, fixed: tidy.line });
			}
		}
	}
	return issues;
}

/** The line with its techniques tagged. The parser reads tags anywhere on a line. */
export function withTechniqueTags(line: string, techniques: string[], vocab: Vocabulary): string {
	const tags = techniques.map((t) => vocab.tagFor(t)).join(" ");
	return `${line.trimEnd()} ${tags}`;
}

/**
 * Where a line's prep note starts: after the `|`, or after the last comma when
 * there's no `|`, the same places the parser looks. -1 when there's no note.
 */
function noteStart(line: string): number {
	const pipe = separatorIndex(line);
	if (pipe !== -1) return pipe + 1;
	const comma = line.lastIndexOf(",");
	return comma === -1 ? -1 : comma + 1;
}

const TAG_SPAN_RE = /#[A-Za-z][\w-]*(?:\/[\w-]+)+/g;

/**
 * The line with every word of its note that names one of its own tagged
 * techniques taken out: "| #prep/chop well chopped" becomes
 * "| #prep/chop well". The words come only from the technique list in
 * settings (its name and "Words that mean it"); the rest of the note, and
 * everything before it, is left exactly as written.
 */
export function withoutRepeatedWords(
	line: string,
	techniques: string[],
	vocab: Vocabulary,
): { line: string; techniques: string[] } {
	const start = noteStart(line);
	if (start === -1) return { line, techniques: [] };
	const note = line.slice(start);
	const tagSpans: [number, number][] = [...note.matchAll(TAG_SPAN_RE)].map((m) => {
		const at = m.index ?? 0;
		return [at, at + m[0].length];
	});
	const inTag = ([a, b]: [number, number]) => tagSpans.some(([x, y]) => a < y && b > x);

	// The note's pieces, split at commas, semicolons and "and", with the tags
	// blanked out (same length, so offsets still line up)
	const blank = note.replace(TAG_SPAN_RE, (m) => " ".repeat(m.length));
	const pieces: [number, number][] = [];
	const sep = /[,;]|\band\b/gi;
	let from = 0;
	for (let m = sep.exec(blank); ; m = sep.exec(blank)) {
		const to = m ? m.index : blank.length;
		const raw = blank.slice(from, to);
		const lead = raw.length - raw.trimStart().length;
		const text = raw.trim();
		if (text) pieces.push([from + lead, from + lead + text.length]);
		if (!m) break;
		from = m.index + m[0].length;
	}
	/**
	 * Only a short piece that ends in the technique's word just restates it:
	 * "cubed", "well chopped", "freshly grated". In anything longer the word is
	 * doing other work ("cut into thin strips", "seeds optional"), so it stays.
	 */
	const restates = ([a, b]: [number, number]) =>
		!inTag([a, b]) &&
		pieces.some(([x, y]) => b === y && a >= x && blank.slice(x, y).split(/\s+/).length <= 2);

	const cuts: [number, number][] = [];
	const repeated: string[] = [];
	for (const t of techniques) {
		const spans = vocab
			.wordsFor(t)
			.flatMap((w) => keywordSpans(note, w))
			.filter(restates);
		if (spans.length > 0) repeated.push(t);
		cuts.push(...spans);
	}
	if (cuts.length === 0) return { line, techniques: [] };

	let text = note;
	for (const [a, b] of cuts.sort((x, y) => y[0] - x[0])) text = text.slice(0, a) + text.slice(b);
	text = text
		// "drained and rinsed" without "rinsed": no "and" left hanging
		.replace(/\s+and(?=\s*(?:[,;]|#|$))/gi, "")
		.replace(/(^|[,;]\s*)and\s+/gi, "$1")
		.replace(/\s*([,;])(?:\s*[,;])+/g, "$1")
		// A cut right after the tags leaves "#prep/slice, thinly"
		.replace(/^(\s*)[,;]\s*/, "$1")
		.replace(/(#[A-Za-z][\w-]*(?:\/[\w-]+)+)\s*[,;]\s*/g, "$1 ")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/[\s,;]+$/, "")
		.replace(/\s+([,;])/g, "$1");

	let head = line.slice(0, start);
	// Nothing left of a comma note but its tags: the comma goes too
	if (!line.slice(0, start).endsWith("|") && !/[^\s#]/.test(text.replace(TAG_SPAN_RE, ""))) {
		head = head.replace(/,\s*$/, "");
		text = text.trim() ? ` ${text.trim()}` : "";
	}
	return { line: `${head}${text}`.trimEnd(), techniques: repeated };
}
