/**
 * How the shopping list sidebar shows items: which recipes each came from,
 * as coloured dots, and checked items after the rest.
 */

/** Theme colours for recipe dots, in the order recipes are listed. */
export const DOT_COLORS = ["blue", "orange", "green", "purple", "pink", "cyan", "yellow", "red"];

/**
 * Which of the known recipe titles an item came from, as indexes into
 * `titles`. An item's recipes are stored joined by ", ", and titles may
 * contain commas themselves, so known titles are matched rather than split.
 * Longer titles are matched first so one title inside another isn't counted twice.
 */
export function recipeIndexes(recipeTitle: string | undefined, titles: readonly string[]): number[] {
	if (!recipeTitle) return [];
	let rest = recipeTitle;
	const found: number[] = [];
	const byLength = titles.map((t, i) => [t, i] as const).sort((a, b) => b[0].length - a[0].length);
	for (const [title, i] of byLength) {
		if (!title || !rest.includes(title)) continue;
		found.push(i);
		rest = rest.replace(title, "");
	}
	return found.sort((a, b) => a - b);
}

/** Unchecked items first, then checked, each keeping its order. */
export function splitDone<T extends { checked: boolean }>(items: readonly T[]): { todo: T[]; done: T[] } {
	return { todo: items.filter((i) => !i.checked), done: items.filter((i) => i.checked) };
}
