import type { Ingredient, IngredientGroup, ShoppingCategory, StoreLayout, Technique } from "../types";
import { DEFAULT_SETTINGS, STARTER_KEYWORD_LISTS } from "./defaults";
import { ingredientsFromKeywordLists, legacyListsFrom, needsIngredientMigration } from "./migrate";

export interface CookbookSettings {
	propsToShow: string[];
	recipesFolder?: string;
	recipesTag?: string;
	cookSoonProp: string;
	coverProp: string;
	ignorePaths: string[];
	/** Kinds of ingredient, in the order a default shop is walked. Names only. */
	shoppingCategories: ShoppingCategory[];
	preferredVolumeUnit?: string;
	preferredWeightUnit?: string;
	hideCheckedItems: boolean;
	/** Dietary groups. Names only; ingredients say which they belong to. */
	ingredientGroups: IngredientGroup[];
	/** Every ingredient the cookbook knows, with its category, groups and staple flag. */
	ingredients: Ingredient[];
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
	/** Categories left out of overlap scoring: their contents are in most recipes. */
	overlapIgnoreCategories: string[];
}

export { DEFAULT_SETTINGS, STARTER_KEYWORD_LISTS };

const copyIngredient = (i: Ingredient): Ingredient => ({ ...i, otherNames: [...i.otherNames], groups: [...i.groups] });

/**
 * A fresh copy of the defaults. The settings tab edits arrays in place, so
 * handing out the shared DEFAULT_SETTINGS objects would let a user edit
 * corrupt the defaults for the rest of the session.
 */
export function cloneDefaultSettings(): CookbookSettings {
	return {
		...DEFAULT_SETTINGS,
		propsToShow: [...DEFAULT_SETTINGS.propsToShow],
		ignorePaths: [...DEFAULT_SETTINGS.ignorePaths],
		ingredientGroups: DEFAULT_SETTINGS.ingredientGroups.map((g) => ({ ...g })),
		shoppingCategories: DEFAULT_SETTINGS.shoppingCategories.map((c) => ({ ...c })),
		ingredients: DEFAULT_SETTINGS.ingredients.map(copyIngredient),
		storeLayouts: DEFAULT_SETTINGS.storeLayouts.map((l) => ({
			...l,
			aisleOrder: [...l.aisleOrder],
		})),
		techniques: DEFAULT_SETTINGS.techniques.map((t) => ({ ...t, keywords: [...t.keywords] })),
		overlapIgnoreCategories: [...DEFAULT_SETTINGS.overlapIgnoreCategories],
	};
}

/**
 * Merge persisted data over the defaults, keeping only known setting keys so
 * unrelated plugin data (the stored shopping list) never leaks into settings.
 *
 * Data saved before the ingredient list existed is converted: the old keyword
 * lists become ingredients, and categories and groups keep their names.
 */
export function mergeSettings(raw: Record<string, unknown>): CookbookSettings {
	const merged = cloneDefaultSettings() as unknown as Record<string, unknown>;
	for (const key of Object.keys(DEFAULT_SETTINGS)) {
		if (raw[key] !== undefined) merged[key] = raw[key];
	}
	const settings = merged as unknown as CookbookSettings;
	if (needsIngredientMigration(raw)) {
		settings.ingredients = ingredientsFromKeywordLists(legacyListsFrom(raw, STARTER_KEYWORD_LISTS));
	}
	// Older data carries keywords on these; only names are kept now
	settings.shoppingCategories = settings.shoppingCategories.map(({ name }) => ({ name }));
	settings.ingredientGroups = settings.ingredientGroups.map(({ name }) => ({ name }));
	return settings;
}

/**
 * Settings as written to data.json. Categories and dietary groups carry an
 * empty `keywords` list that this version ignores: 1.5 iterates them, so a
 * device still on 1.5 that syncs this file files items as Uncategorized
 * instead of throwing.
 */
export function toSavedData(settings: CookbookSettings): Record<string, unknown> {
	return {
		...settings,
		shoppingCategories: settings.shoppingCategories.map((c) => ({ ...c, keywords: [] })),
		ingredientGroups: settings.ingredientGroups.map((g) => ({ ...g, keywords: [] })),
	};
}

/** Keys that 1.5 and earlier stored and the ingredient list replaced. */
const RETIRED_SETTING_KEYS = ["ingredientAliases", "stapleIngredients"];

/**
 * What to save after converting old data: the converted settings, without
 * the retired keys, plus the old keyword lists once under
 * `legacyKeywordLists` so nothing typed by hand is lost. Everything else in
 * the file (the stored shopping list) is kept.
 */
export function convertedData(raw: Record<string, unknown>, settings: CookbookSettings): Record<string, unknown> {
	const kept = Object.fromEntries(Object.entries(raw).filter(([key]) => !RETIRED_SETTING_KEYS.includes(key)));
	return {
		...kept,
		...toSavedData(settings),
		legacyKeywordLists: legacyListsFrom(raw, STARTER_KEYWORD_LISTS),
	};
}
