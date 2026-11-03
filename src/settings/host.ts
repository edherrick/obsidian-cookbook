import type { App } from "obsidian";
import type CookbookPlugin from "../main";

/** What the settings definitions need from the settings tab. */
export interface SettingsHost {
	app: App;
	plugin: CookbookPlugin;
	/** Save after typing pauses. */
	saveSoon(): void;
	/** Save now, for structural edits like adding or removing an item. */
	saveNow(): void;
	/** Rebuild the definitions and re-render the open page. */
	refresh(): void;
}

/** `base`, or `base 2`, `base 3`… whichever is not taken. Rows are keyed by name. */
export function uniqueName(base: string, taken: string[]): string {
	if (!taken.includes(base)) return base;
	let n = 2;
	while (taken.includes(`${base} ${n}`)) n++;
	return `${base} ${n}`;
}

export function commaList(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Split pasted or typed text on commas and new lines, dropping empty pieces. */
export function splitList(raw: string): string[] {
	return raw
		.split(/[,\n]/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Add the keywords in `raw` (separated by commas or new lines) to `existing`.
 * Keywords already present, in any letter case, are skipped, as are repeats
 * within `raw` itself, so pasting a list twice changes nothing.
 */
export function mergeKeywords(existing: readonly string[], raw: string): string[] {
	const seen = new Set(existing.map((k) => k.toLowerCase()));
	const result = [...existing];
	for (const keyword of splitList(raw)) {
		if (seen.has(keyword.toLowerCase())) continue;
		seen.add(keyword.toLowerCase());
		result.push(keyword);
	}
	return result;
}

/**
 * Sort typed values into the allowed choices they name (ignoring letter case,
 * returned in the choice's own spelling) and the ones that match nothing.
 */
export function matchChoices(values: readonly string[], choices: readonly string[]): { matched: string[]; unmatched: string[] } {
	const byLower = new Map(choices.map((c) => [c.toLowerCase(), c]));
	const matched: string[] = [];
	const unmatched: string[] = [];
	for (const value of values) {
		const choice = byLower.get(value.toLowerCase());
		if (choice === undefined) unmatched.push(value);
		else matched.push(choice);
	}
	return { matched, unmatched };
}
