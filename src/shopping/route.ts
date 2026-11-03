import { UNCATEGORIZED } from "../ingredients/categorize";
import type { ShoppingCategory, StoreLayout } from "../types";

/**
 * A store's aisle order, matched to the categories that exist now.
 *
 * Routes are saved once and categories change after, so a route can name a
 * deleted category or miss a new one. Deleted ones drop out; new ones go at
 * the end, in category order, so every category has a place.
 */
export function resolveRoute(aisleOrder: readonly string[], categories: readonly ShoppingCategory[]): string[] {
	const names = categories.map((c) => c.name).filter((n) => n && n !== UNCATEGORIZED);
	const known = new Set(names);
	const route: string[] = [];
	for (const name of aisleOrder) {
		if (known.has(name) && !route.includes(name)) route.push(name);
	}
	for (const name of names) {
		if (!route.includes(name)) route.push(name);
	}
	return route;
}

/**
 * The aisle an item is in at this store, if any. An ingredient moved to an
 * aisle wins over its category's aisle; if either is listed twice, the
 * lowest-numbered aisle wins.
 */
export function aisleFor(
	layout: StoreLayout | undefined,
	category: string,
	ingredient: string | undefined,
): number | undefined {
	const aisles = [...(layout?.aisles ?? [])].sort((a, b) => a.number - b.number);
	const name = ingredient?.toLowerCase();
	const moved = name ? aisles.find((a) => a.ingredients.some((i) => i.toLowerCase() === name)) : undefined;
	return (moved ?? aisles.find((a) => a.categories.includes(category)))?.number;
}

export interface ListGroup<T> {
	key: string;
	/** "Aisle 7", or a category name. */
	label: string;
	/** For an aisle: the categories of the items in it. */
	detail?: string;
	/** Set for an aisle; unset for a category not in any aisle. */
	aisle?: number;
	/** Set for a category group, which can be reordered by dragging. */
	category?: string;
	items: T[];
}

/**
 * Lay a shopping list out for a store: its numbered aisles in order, then
 * every category it hasn't put in an aisle, in `categoryOrder` (anything that
 * names none goes last). A store with no aisles is just the category order.
 */
export function groupForStore<T extends { category: string }>(
	items: readonly T[],
	options: {
		layout?: StoreLayout;
		categoryOrder: readonly string[];
		/** The ingredient an item is, for aisles that move single ingredients. */
		ingredientOf?: (item: T) => string | undefined;
	},
): ListGroup<T>[] {
	const aisles = new Map<number, T[]>();
	const categories = new Map<string, T[]>();
	for (const item of items) {
		const category = item.category || UNCATEGORIZED;
		const aisle = aisleFor(options.layout, category, options.ingredientOf?.(item));
		if (aisle !== undefined) {
			if (!aisles.has(aisle)) aisles.set(aisle, []);
			aisles.get(aisle)!.push(item);
		} else {
			if (!categories.has(category)) categories.set(category, []);
			categories.get(category)!.push(item);
		}
	}

	const groups: ListGroup<T>[] = [...aisles.entries()]
		.sort(([a], [b]) => a - b)
		.map(([aisle, list]) => ({
			key: `aisle:${aisle}`,
			label: `Aisle ${aisle}`,
			detail: [...new Set(list.map((i) => i.category || UNCATEGORIZED))].join(", "),
			aisle,
			items: list,
		}));
	const ordered = [
		...options.categoryOrder.filter((c) => categories.has(c)),
		...[...categories.keys()].filter((c) => !options.categoryOrder.includes(c)),
	];
	for (const category of ordered) {
		groups.push({ key: `category:${category}`, label: category, category, items: categories.get(category)! });
	}
	return groups;
}
