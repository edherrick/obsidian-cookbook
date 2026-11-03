import type { CookbookSettings } from "./index";

/**
 * Follow a shopping category rename everywhere settings name it: ingredients,
 * store routes and the ignored categories. Without this, a renamed category
 * loses its ingredients, drops to the bottom of every route and stops being
 * ignored.
 */
export function renameCategory(settings: CookbookSettings, from: string, to: string): void {
	const name = to.trim();
	if (!name || from === name) return;
	for (const ingredient of settings.ingredients) {
		if (ingredient.category === from) ingredient.category = name;
	}
	for (const layout of settings.storeLayouts) {
		layout.aisleOrder = replaceName(layout.aisleOrder, from, name, false);
		for (const aisle of layout.aisles ?? []) aisle.categories = replaceName(aisle.categories, from, name, false);
	}
	// Ignored aisles were typed by hand, so match them in any letter case
	settings.overlapIgnoreCategories = replaceName(settings.overlapIgnoreCategories, from, name, true);
}

/** Forget a deleted category: its ingredients become Uncategorized. */
export function deleteCategory(settings: CookbookSettings, name: string): void {
	for (const ingredient of settings.ingredients) {
		if (ingredient.category === name) ingredient.category = "";
	}
	for (const layout of settings.storeLayouts) {
		layout.aisleOrder = layout.aisleOrder.filter((n) => n !== name);
		for (const aisle of layout.aisles ?? []) aisle.categories = aisle.categories.filter((n) => n !== name);
	}
	settings.overlapIgnoreCategories = settings.overlapIgnoreCategories.filter(
		(n) => n.toLowerCase() !== name.toLowerCase(),
	);
}

/** Follow a dietary group rename onto every ingredient tagged with it. */
export function renameGroup(settings: CookbookSettings, from: string, to: string): void {
	const name = to.trim();
	if (!name || from === name) return;
	for (const ingredient of settings.ingredients) {
		ingredient.groups = replaceName(ingredient.groups, from, name, false);
	}
}

/** Untag a deleted dietary group from every ingredient. */
export function deleteGroup(settings: CookbookSettings, name: string): void {
	for (const ingredient of settings.ingredients) {
		ingredient.groups = ingredient.groups.filter((g) => g !== name);
	}
}

/** Follow an ingredient rename into the aisles that move it. */
export function renameIngredient(settings: CookbookSettings, from: string, to: string): void {
	const name = to.trim();
	if (!name || from === name) return;
	for (const layout of settings.storeLayouts) {
		for (const aisle of layout.aisles ?? []) aisle.ingredients = replaceName(aisle.ingredients, from, name, true);
	}
}

/** Take a deleted ingredient out of the aisles that move it. */
export function deleteIngredient(settings: CookbookSettings, name: string): void {
	for (const layout of settings.storeLayouts) {
		for (const aisle of layout.aisles ?? []) {
			aisle.ingredients = aisle.ingredients.filter((n) => n.toLowerCase() !== name.toLowerCase());
		}
	}
}

/** Swap `from` for `to`, dropping it instead if `to` is already listed. */
function replaceName(list: string[], from: string, to: string, anyCase: boolean): string[] {
	const same = (a: string, b: string) => (anyCase ? a.toLowerCase() === b.toLowerCase() : a === b);
	if (!list.some((n) => same(n, from))) return list;
	const hasTarget = list.some((n) => same(n, to));
	return list.flatMap((n) => (same(n, from) ? (hasTarget ? [] : [to]) : [n]));
}
