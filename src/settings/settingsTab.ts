import { PluginSettingTab, debounce } from "obsidian";
import type { App, Debouncer, Setting, SettingDefinitionItem } from "obsidian";
import type CookbookPlugin from "../main";
import type { CookbookSettings } from "./index";
import { cloneDefaultSettings } from "./index";
import { commaList } from "./host";
import type { SettingsHost } from "./host";
import { keywordList } from "./keywordList";
import { keywordField } from "./keywordField";
import type { KeywordFieldOptions } from "./keywordField";
import { deleteCategory, deleteGroup, renameCategory, renameGroup } from "./renameCategory";
import { nameList } from "./nameList";
import { ingredientListItems } from "./ingredientList";
import { storeLayoutItems } from "./storeLayouts";
import { PathPickerModal } from "./pathPickerModal";
import { renderIngredientNamesPanel } from "./ingredientNamesPanel";
import type { IngredientNamesState } from "./ingredientNamesPanel";

/** Keystrokes shouldn't each cost a disk read + write. */
const SAVE_DEBOUNCE_MS = 400;

const VOLUME_UNITS = ["ml", "tsp", "tbsp", "cups", "pt", "l"];
const WEIGHT_UNITS = ["g", "kg", "oz", "lb"];

/**
 * How a control's shown value maps to a stored setting, for settings that
 * aren't stored the way they're edited. Anything not listed is read and
 * written as-is.
 */
interface Codec {
	get: (s: CookbookSettings) => unknown;
	set: (s: CookbookSettings, value: unknown) => void;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** A text property that falls back to its default when cleared. */
const withFallback = (key: "cookSoonProp" | "coverProp" | "cookTogetherProp", fallback: string): Codec => ({
	get: (s) => s[key],
	set: (s, v) => {
		s[key] = text(v).trim() || fallback;
	},
});

const CODECS: Partial<Record<keyof CookbookSettings, Codec>> = {
	propsToShow: {
		get: (s) => s.propsToShow.join(", "),
		set: (s, v) => {
			s.propsToShow = commaList(text(v));
		},
	},
	recipesFolder: {
		// "." means the whole vault, shown as an empty field
		get: (s) => (s.recipesFolder && s.recipesFolder !== "." ? s.recipesFolder : ""),
		set: (s, v) => {
			s.recipesFolder = text(v).trim() || ".";
		},
	},
	recipesTag: {
		get: (s) => s.recipesTag ?? "#recipe",
		set: (s, v) => {
			const tag = text(v).trim() || "#recipe";
			s.recipesTag = tag.startsWith("#") ? tag : `#${tag}`;
		},
	},
	cookSoonProp: withFallback("cookSoonProp", "cook-soon"),
	coverProp: withFallback("coverProp", "cover"),
	cookTogetherProp: withFallback("cookTogetherProp", "cook-together"),
	cookSessionFolder: {
		get: (s) => s.cookSessionFolder,
		set: (s, v) => {
			s.cookSessionFolder = text(v).trim();
		},
	},
	techniqueTagPrefix: {
		get: (s) => s.techniqueTagPrefix,
		set: (s, v) => {
			s.techniqueTagPrefix =
				text(v).replace(/^#/, "").replace(/\/+$/, "").trim() || "prep";
		},
	},
	preferredVolumeUnit: {
		get: (s) => s.preferredVolumeUnit ?? "",
		set: (s, v) => {
			s.preferredVolumeUnit = text(v) || undefined;
		},
	},
	preferredWeightUnit: {
		get: (s) => s.preferredWeightUnit ?? "",
		set: (s, v) => {
			s.preferredWeightUnit = text(v) || undefined;
		},
	},
	shoppingListFilePath: {
		get: (s) => s.shoppingListFilePath ?? "",
		set: (s, v) => {
			s.shoppingListFilePath = text(v).trim() || undefined;
		},
	},
	activeStoreLayout: {
		get: (s) => s.activeStoreLayout ?? s.storeLayouts[0]?.name ?? "",
		set: (s, v) => {
			s.activeStoreLayout = text(v);
		},
	},
};

const unitOptions = (units: string[]): Record<string, string> => ({
	"": "Auto",
	...Object.fromEntries(units.map((u) => [u, u])),
});

export class CookbookSettingTab extends PluginSettingTab implements SettingsHost {
	plugin: CookbookPlugin;
	private readonly saveDebounced: Debouncer<[], void>;
	private readonly namesState: IngredientNamesState = { names: null };

	constructor(app: App, plugin: CookbookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.icon = "utensils";
		this.saveDebounced = debounce(() => void this.plugin.saveSettings(), SAVE_DEBOUNCE_MS, false);
	}

	// ─── SettingsHost ────────────────────────────────────────────────────────

	saveSoon(): void {
		this.saveDebounced();
	}

	saveNow(): void {
		this.saveDebounced.cancel();
		void this.plugin.saveSettings();
	}

	refresh(): void {
		this.update();
	}

	/** Write any pending edit now, so closing settings can't drop the last keystrokes. */
	hide(): void {
		this.saveDebounced.run();
		super.hide();
	}

	// ─── Control values ──────────────────────────────────────────────────────
	// Overridden because the default writes plugin.settings straight to disk,
	// which would drop the shopping list stored alongside it in data.json.

	getControlValue(key: string): unknown {
		const settings = this.plugin.settings;
		const codec = CODECS[key as keyof CookbookSettings];
		return codec ? codec.get(settings) : (settings as unknown as Record<string, unknown>)[key];
	}

	setControlValue(key: string, value: unknown): void {
		const settings = this.plugin.settings;
		const codec = CODECS[key as keyof CookbookSettings];
		if (codec) codec.set(settings, value);
		else (settings as unknown as Record<string, unknown>)[key] = value;
		this.saveSoon();
		// The open shopping list follows the active store's aisle order
		if (key === "activeStoreLayout") void this.plugin.applyActiveRoute();
	}

	// ─── Definitions ─────────────────────────────────────────────────────────

	getSettingDefinitions(): SettingDefinitionItem[] {
		const { settings } = this.plugin;
		const defaults = () => cloneDefaultSettings();
		const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		const usage = (n: number) => count(n, "ingredient", "ingredients");

		return [
			{
				type: "group",
				heading: "Recipes",
				items: [
					{
						name: "Properties to display",
						desc: "Frontmatter properties to show in the recipe grid. Comma-separated list.",
						control: { type: "text", key: "propsToShow", placeholder: "title, cook-time, cover" },
					},
					{
						name: "Folder for recipes",
						desc: "Path to the folder where your recipes are stored.",
						control: { type: "folder", key: "recipesFolder", placeholder: "Defaults to entire vault" },
					},
					{
						name: "Tag for recipes",
						desc: "The tag that identifies recipe files.",
						control: { type: "text", key: "recipesTag", placeholder: "Defaults to #recipe" },
					},
					{
						name: "Cook-soon property",
						desc: "The frontmatter property used to mark recipes as cook-soon. Change this if your vault uses a different key (such as make-soon).",
						control: { type: "text", key: "cookSoonProp", placeholder: "cook-soon" },
					},
					{
						name: "Cover image property",
						desc: "The frontmatter property used as the recipe cover image. Accepts a URL, a vault path, or a wikilink. Change this if your vault uses a different key (such as thumbnail or banner).",
						control: { type: "text", key: "coverProp", placeholder: "cover" },
					},
				],
			},
			{
				type: "list",
				heading: "Ignored files and folders",
				emptyState: "Nothing is ignored. Ignoring a folder ignores every file inside it.",
				items: settings.ignorePaths.map((path) => ({ name: path })),
				onDelete: (index) => {
					settings.ignorePaths = settings.ignorePaths.filter((_, i) => i !== index);
					this.saveNow();
					this.refresh();
				},
				addItem: {
					name: "Ignore a file or folder",
					action: () =>
						new PathPickerModal(this.app, (path) => {
							if (settings.ignorePaths.includes(path)) return;
							settings.ignorePaths = [...settings.ignorePaths, path];
							this.saveNow();
							this.refresh();
						}).open(),
				},
			},
			{
				type: "group",
				heading: "Shopping list",
				items: [
					{
						name: "Preferred volume unit",
						desc: "Unit to display when aggregating volume ingredients across recipes. Auto uses whichever unit appears first.",
						control: { type: "dropdown", key: "preferredVolumeUnit", options: unitOptions(VOLUME_UNITS) },
					},
					{
						name: "Preferred weight unit",
						desc: "Unit to display when aggregating weight ingredients across recipes. Auto uses whichever unit appears first.",
						control: { type: "dropdown", key: "preferredWeightUnit", options: unitOptions(WEIGHT_UNITS) },
					},
					{
						name: "Hide checked items",
						desc: "When enabled, items disappear from the shopping list as soon as they are checked off.",
						control: { type: "toggle", key: "hideCheckedItems" },
					},
					{
						name: "Shopping list vault file",
						desc: "If set, the shopping list is saved to this Markdown file in your vault instead of plugin storage. Leave empty to use internal storage.",
						control: { type: "file", key: "shoppingListFilePath", placeholder: "shopping-list.md" },
					},
					{
						type: "page",
						name: "Ingredients",
						desc: "Every ingredient the cookbook knows: its category, dietary groups, other names, and whether it's a staple.",
						displayValue: count(settings.ingredients.length, "ingredient", "ingredients"),
						items: [
							{
								type: "group",
								items: [
									{
										type: "page",
										name: "Categories",
										desc: "Kinds of ingredient, such as Produce or Dairy. The shopping list groups items by them.",
										displayValue: count(settings.shoppingCategories.length, "category", "categories"),
										items: [
											nameList(this, {
												getItems: () => settings.shoppingCategories,
												newItemName: "New category",
												addLabel: "Add category",
												emptyState: "No categories. Every item will be uncategorized.",
												namePlaceholder: "Name (e.g. Produce)",
												reorderable: true,
												usage: (name) => usage(settings.ingredients.filter((i) => i.category === name).length),
												onRename: (from, to) => renameCategory(settings, from, to),
												onDelete: (name) => deleteCategory(settings, name),
											}),
										],
									},
									{
										type: "page",
										name: "Dietary groups",
										desc: "Groups used to filter recipes by dietary need, such as no dairy or no gluten.",
										displayValue: count(settings.ingredientGroups.length, "group", "groups"),
										items: [
											nameList(this, {
												getItems: () => settings.ingredientGroups,
												newItemName: "New group",
												addLabel: "Add group",
												emptyState: "No groups.",
												namePlaceholder: "Name (e.g. Dairy)",
												usage: (name) => usage(settings.ingredients.filter((i) => i.groups.includes(name)).length),
												onRename: (from, to) => renameGroup(settings, from, to),
												onDelete: (name) => deleteGroup(settings, name),
											}),
										],
									},
									{
										type: "page",
										name: "Staples",
										desc: "Ingredients nearly every recipe uses. They're left out when finding recipes that cook well together.",
										displayValue: count(settings.ingredients.filter((i) => i.staple).length, "staple", "staples"),
										items: [
											{
												type: "group",
												items: [
													{
														name: "Staple ingredients",
														desc: "Ingredients nearly every recipe uses, such as salt or olive oil. They're left out when finding recipes that cook well together. Same as the Staple switch on each ingredient.",
														render: (setting: Setting) =>
															this.renderPillSetting(setting, {
																placeholder: "Choose an ingredient",
																get: () => settings.ingredients.filter((i) => i.staple).map((i) => i.name),
																set: (value) => {
																	const staples = new Set(value.map((v) => v.toLowerCase()));
																	for (const i of settings.ingredients) {
																		if (staples.has(i.name.toLowerCase())) i.staple = true;
																		else delete i.staple;
																	}
																	this.saveSoon();
																},
																choices: {
																	app: this.app,
																	items: () => settings.ingredients.map((i) => i.name),
																	noun: "ingredient",
																},
															}),
													},
												],
											},
										],
									},
								],
							},
							...ingredientListItems(this),
							{
								type: "group",
								heading: "Ingredient names in your recipes",
								items: [
									{
										name: "Find duplicates and missing ingredients",
										desc: "Add names your recipes use to the list, or merge names that are one ingredient.",
										searchable: true,
										render: (setting: Setting) => this.renderNamesPanel(setting),
									},
								],
							},
						],
					},
					{
						type: "page",
						name: "Store layouts",
						desc: "The order you walk each shop's aisles. Open a store to reorder its aisles, or drag categories in the shopping list.",
						displayValue: count(settings.storeLayouts.length, "store", "stores"),
						items: storeLayoutItems(this),
					},
				],
			},
			{
				type: "group",
				heading: "Cooking sessions",
				items: [
					{
						name: "Cook-together property",
						desc: "The frontmatter property that marks recipes to cook in one session.",
						control: { type: "text", key: "cookTogetherProp", placeholder: "cook-together" },
					},
					{
						name: "Session folder",
						desc: "Where cooking session notes are written. One note per day, regenerated in place.",
						control: { type: "folder", key: "cookSessionFolder", placeholder: "recipes/cook sessions" },
					},
					{
						type: "page",
						name: "Prep techniques",
						desc: "Tag a technique on an ingredient line with #prefix/name, such as #prep/dice. The order here is the order of the prep list in a cooking session.",
						displayValue: count(settings.techniques.length, "technique", "techniques"),
						items: [
							{
								type: "group",
								items: [
									{
										name: "Technique tag prefix",
										desc: "The parent tag for techniques. Changing it does not rewrite existing tags.",
										control: { type: "text", key: "techniqueTagPrefix", placeholder: "prep" },
									},
								],
							},
							keywordList(this, {
								getItems: () => settings.techniques,
								restoreDefaults: () => {
									settings.techniques = defaults().techniques;
								},
								newItemName: "new technique",
								addLabel: "Add technique",
								emptyState: "No techniques. Only tagged lines will count.",
								namePlaceholder: "Name (e.g. dice)",
								keywordsPlaceholder: "Words that mean it, e.g. diced, cubed",
								keywordsLabel: "Words that mean it",
								countNoun: ["word", "words"],
								reorderable: true,
							}),
						],
					},
				],
			},
			{
				type: "group",
				heading: "Overlap",
				items: [
					{
						name: "Ignored categories",
						desc: "Shopping categories whose ingredients don't count as overlap.",
						render: (setting: Setting) =>
							this.renderPillSetting(setting, {
								placeholder: "Choose a category",
								get: () => settings.overlapIgnoreCategories,
								set: (value) => {
									settings.overlapIgnoreCategories = value;
									this.saveSoon();
								},
								choices: {
									app: this.app,
									items: () => settings.shoppingCategories.map((c) => c.name),
									noun: "category",
								},
							}),
					},
				],
			},
		];
	}

	/** A setting whose value is a list, edited as pills under its name. */
	private renderPillSetting(setting: Setting, opts: KeywordFieldOptions): () => void {
		setting.settingEl.addClass("cookbook-pill-setting");
		const field = keywordField(setting.settingEl, opts);
		// "Edit as text" sits beside the setting's name, where its controls go
		const header = setting.settingEl.querySelector(".cookbook-row-field-header");
		const mode = header?.querySelector(".cookbook-field-mode");
		if (mode) setting.controlEl.appendChild(mode);
		// The setting's name now labels the field for screen readers
		const labelId = header?.querySelector(".cookbook-row-field-label")?.id;
		header?.remove();
		if (labelId) setting.nameEl.id = labelId;
		return () => field.destroy();
	}

	private renderNamesPanel(setting: Setting): void {
		setting.settingEl.addClass("cookbook-names-setting");
		const host = setting.settingEl.createDiv({ cls: "cookbook-names-host" });
		renderIngredientNamesPanel(host, this.plugin, this.namesState, () => this.refresh());
	}
}
