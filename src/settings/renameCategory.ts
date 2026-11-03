import type { CookbookSettings } from "./index";

/**
 * Follow a shopping category rename everywhere settings name it: store
 * routes and the ignored aisles. Without this, a renamed category drops to
 * the bottom of every route and stops being ignored.
 */
export function renameCategory(settings: CookbookSettings, from: string, to: string): void {
	const name = to.trim();
	if (!name || from === name) return;
	for (const layout of settings.storeLayouts) {
		layout.aisleOrder = replaceName(layout.aisleOrder, from, name, false);
	}
	// Ignored aisles were typed by hand, so match them in any letter case
	settings.overlapIgnoreCategories = replaceName(settings.overlapIgnoreCategories, from, name, true);
}

/** Swap `from` for `to`, dropping it instead if `to` is already listed. */
function replaceName(list: string[], from: string, to: string, anyCase: boolean): string[] {
	const same = (a: string, b: string) => (anyCase ? a.toLowerCase() === b.toLowerCase() : a === b);
	if (!list.some((n) => same(n, from))) return list;
	const hasTarget = list.some((n) => same(n, to));
	return list.flatMap((n) => (same(n, from) ? (hasTarget ? [] : [to]) : [n]));
}
