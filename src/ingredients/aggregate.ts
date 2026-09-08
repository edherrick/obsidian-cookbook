import type { ShoppingItem } from "../types";
import { normalizeIngredientName } from "./normalize";
import { canonicalUnit, fromBaseUnit, getUnitDimension, roundQty, toBaseUnit } from "./units";

export interface DisplayUnitPrefs {
	preferredVolumeUnit?: string;
	preferredWeightUnit?: string;
}

/**
 * Aggregate shopping items by normalised name + unit dimension.
 * - Same unit: quantities are summed directly.
 * - Different units, same dimension (both volume or both weight):
 *   converted to a base unit, summed, and displayed in the preferred unit.
 * - Count units (cloves, cans…) only merge when the unit is identical.
 * - Incompatible units (volume vs weight): kept as separate entries.
 * - Items without units: aggregated by name only.
 *
 * Matching is done on the normalised name, so "soy sauce" and "soy sauce, to
 * taste" are one line rather than two.
 */
export function aggregateItems(items: ShoppingItem[], prefs?: DisplayUnitPrefs): ShoppingItem[] {
	const map = new Map<string, ShoppingItem>();

	for (const item of items) {
		const nameKey = normalizeIngredientName(item.text) || item.text.toLowerCase().trim();
		const dimension = item.unit ? getUnitDimension(item.unit) : null;
		// Counts never convert, so the unit itself is part of their identity
		const key =
			dimension === "count"
				? `${nameKey}::count::${canonicalUnit(item.unit!)}`
				: dimension
					? `${nameKey}::${dimension}`
					: nameKey;

		const existing = map.get(key);
		if (!existing) {
			map.set(key, { ...item });
			continue;
		}

		if (existing.quantity !== null && item.quantity !== null) {
			if (!existing.unit || !item.unit || canonicalUnit(existing.unit) === canonicalUnit(item.unit)) {
				// No units or same unit — plain addition
				existing.quantity = roundQty(existing.quantity + item.quantity);
			} else if (dimension && dimension !== "count") {
				// Different units, same dimension — convert via base
				const base =
					toBaseUnit(existing.quantity, existing.unit) + toBaseUnit(item.quantity, item.unit);
				const preferUnit =
					dimension === "volume"
						? prefs?.preferredVolumeUnit || existing.unit
						: prefs?.preferredWeightUnit || existing.unit;
				const converted = fromBaseUnit(base, dimension, preferUnit);
				existing.quantity = converted.qty;
				existing.unit = converted.unit;
			}
		} else if (item.quantity !== null) {
			existing.quantity = item.quantity;
			existing.unit = item.unit;
		}

		if (item.recipeTitle && !existing.recipeTitle?.includes(item.recipeTitle)) {
			existing.recipeTitle = existing.recipeTitle
				? `${existing.recipeTitle}, ${item.recipeTitle}`
				: item.recipeTitle;
		}
		if (item.prep && !existing.prep?.includes(item.prep)) {
			existing.prep = existing.prep ? `${existing.prep} | ${item.prep}` : item.prep;
		}
	}

	return Array.from(map.values());
}
