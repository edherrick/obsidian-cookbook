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
