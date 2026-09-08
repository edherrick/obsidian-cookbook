import type { ShoppingCategory, IngredientGroup } from "../types";
import { DEFAULT_SETTINGS } from "./defaults";

export interface CookbookSettings {
	propsToShow: string[];
	recipesFolder?: string;
	recipesTag?: string;
	cookSoonProp: string;
	coverProp: string;
	ignorePaths: string[];
	shoppingCategories: ShoppingCategory[];
	preferredVolumeUnit?: string;
	preferredWeightUnit?: string;
	hideCheckedItems: boolean;
	ingredientGroups: IngredientGroup[];
	shoppingListFilePath?: string;
}

export { DEFAULT_SETTINGS };

/**
 * A fresh copy of the defaults. The settings tab edits category and group
 * arrays in place, so handing out the shared DEFAULT_SETTINGS objects would
 * let a user edit corrupt the defaults for the rest of the session.
 */
export function cloneDefaultSettings(): CookbookSettings {
	return {
		...DEFAULT_SETTINGS,
		propsToShow: [...DEFAULT_SETTINGS.propsToShow],
		ignorePaths: [...DEFAULT_SETTINGS.ignorePaths],
		ingredientGroups: DEFAULT_SETTINGS.ingredientGroups.map((g) => ({
			...g,
			keywords: [...g.keywords],
		})),
		shoppingCategories: DEFAULT_SETTINGS.shoppingCategories.map((c) => ({
			...c,
			keywords: [...c.keywords],
		})),
	};
}

/**
 * Merge persisted data over the defaults, keeping only known setting keys so
 * unrelated plugin data (the stored shopping list) never leaks into settings.
 */
export function mergeSettings(raw: Record<string, unknown>): CookbookSettings {
	const merged = cloneDefaultSettings() as unknown as Record<string, unknown>;
	for (const key of Object.keys(DEFAULT_SETTINGS)) {
		if (raw[key] !== undefined) merged[key] = raw[key];
	}
	return merged as unknown as CookbookSettings;
}
