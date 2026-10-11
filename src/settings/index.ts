import type {
	ShoppingCategory,
	IngredientGroup,
	StoreLayout,
	Technique,
	IngredientAlias,
} from "../types";
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
	/** One route per shop; the active one orders the shopping list. */
	storeLayouts: StoreLayout[];
	activeStoreLayout?: string;
	/** Marks recipes to be cooked in one session, separately from cook-soon. */
	cookTogetherProp: string;
	cookSessionFolder: string;
	/** Technique tags are `#<prefix>/<name>`. */
	techniqueTagPrefix: string;
	techniques: Technique[];
	ingredientAliases: IngredientAlias[];
	/** Ingredients nearly every recipe uses; they say nothing about overlap. */
	stapleIngredients: string[];
	/** Aisles left out of overlap scoring, for the same reason. */
	overlapIgnoreCategories: string[];
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
			...(g.excludeKeywords ? { excludeKeywords: [...g.excludeKeywords] } : {}),
		})),
		shoppingCategories: DEFAULT_SETTINGS.shoppingCategories.map((c) => ({
			...c,
			keywords: [...c.keywords],
		})),
		storeLayouts: DEFAULT_SETTINGS.storeLayouts.map((l) => ({
			...l,
			aisleOrder: [...l.aisleOrder],
		})),
		techniques: DEFAULT_SETTINGS.techniques.map((t) => ({ ...t, keywords: [...t.keywords] })),
		ingredientAliases: DEFAULT_SETTINGS.ingredientAliases.map((a) => ({
			...a,
			keywords: [...a.keywords],
		})),
		stapleIngredients: [...DEFAULT_SETTINGS.stapleIngredients],
		overlapIgnoreCategories: [...DEFAULT_SETTINGS.overlapIgnoreCategories],
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
