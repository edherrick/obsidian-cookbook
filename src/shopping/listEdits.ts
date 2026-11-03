import type { PersistedShoppingList } from "../types";

/**
 * Carry a category rename (or, with `to` null, a deletion) into a saved
 * shopping list, so its items stay in their aisle instead of dropping to the
 * bottom under a name that no longer exists. Returns null if nothing changed.
 */
export function renameListCategory(
	list: PersistedShoppingList,
	from: string,
	to: string | null,
): PersistedShoppingList | null {
	const name = to?.trim() ?? "";
	if (from === name) return null;
	const touched = list.items.some((i) => i.category === from) || list.categoryOrder.includes(from);
	if (!touched) return null;

	const order = list.categoryOrder.flatMap((c) => (c === from ? (name ? [name] : []) : [c]));
	return {
		...list,
		items: list.items.map((i) => (i.category === from ? { ...i, category: name } : i)),
		// A rename onto a name already in the order keeps its first place
		categoryOrder: order.filter((c, i) => order.indexOf(c) === i),
	};
}
