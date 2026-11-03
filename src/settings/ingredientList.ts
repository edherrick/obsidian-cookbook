import { DropdownComponent, Notice, setIcon, ToggleComponent } from "obsidian";
import type { Setting, SettingDefinitionItem } from "obsidian";
import type { Ingredient } from "../types";
import { STARTER_KEYWORD_LISTS } from "./defaults";
import { ingredientsFromKeywordLists } from "./migrate";
import { keywordField } from "./keywordField";
import type { KeywordField } from "./keywordField";
import { uniqueName } from "./host";
import { TextPromptModal } from "./textPromptModal";
import { deleteIngredient, renameIngredient } from "./renameCategory";
import type { SettingsHost } from "./host";

/** Dropdown value that opens the new-category prompt. Can't clash: names are trimmed. */
const NEW_CATEGORY = " new";

/** Rows the user has opened, kept across refresh() by keying on the ingredient itself. */
const expanded = new WeakSet<Ingredient>();

const lower = (s: string) => s.trim().toLowerCase();

/** One-line description of an ingredient's tags, for the collapsed row and search. */
function describe(i: Ingredient): string {
	return [i.category || "Uncategorized", ...i.groups, ...(i.staple ? ["staple"] : [])].join(" · ");
}

/**
 * The ingredient list: one row per ingredient, each tagged with a category,
 * dietary groups, other names and a staple flag. Search matches names, other
 * names and tags, so "Dairy" or "staple" lists those ingredients.
 */
export function ingredientListItems(host: SettingsHost): SettingDefinitionItem[] {
	const { settings } = host.plugin;
	const structural = () => {
		host.saveNow();
		host.refresh();
	};

	return [
		{
			type: "list",
			emptyState: "No ingredients yet. Add one, or add the names your recipes use below.",
			search: {
				placeholder: "Search ingredients, categories or tags",
				match: (def, query) => {
					const q = lower(query);
					return !q || def.name.toLowerCase().includes(q) || (typeof def.desc === "string" && def.desc.toLowerCase().includes(q));
				},
			},
			extraButtons: [
				(b) =>
					b
						.setIcon("list-plus")
						.setTooltip("Add any starter ingredients that are missing")
						.onClick(() => {
							const have = new Set(settings.ingredients.flatMap((i) => [i.name, ...i.otherNames]).map(lower));
							const missing = ingredientsFromKeywordLists(STARTER_KEYWORD_LISTS).filter(
								(i) => !have.has(lower(i.name)),
							);
							settings.ingredients.push(...missing);
							new Notice(missing.length ? `Added ${missing.length} starter ingredients.` : "Every starter ingredient is already listed.");
							structural();
						}),
			],
			items: settings.ingredients.map((ingredient) => ({
				name: ingredient.name,
				// Not shown (the row draws its own summary) but searched
				desc: [describe(ingredient), ...ingredient.otherNames].join(" "),
				render: (setting: Setting) => renderRow(setting, ingredient, host),
			})),
			onDelete: (index) => {
				const [removed] = settings.ingredients.splice(index, 1);
				if (removed) deleteIngredient(settings, removed.name);
				structural();
			},
			addItem: {
				name: "Add ingredient",
				action: () => {
					const ingredient: Ingredient = {
						name: uniqueName(
							"new ingredient",
							settings.ingredients.map((i) => i.name),
						),
						otherNames: [],
						category: "",
						groups: [],
					};
					// New entries go first, where they can be seen and named
					settings.ingredients.unshift(ingredient);
					expanded.add(ingredient);
					structural();
				},
			},
		},
	];
}

function renderRow(setting: Setting, ingredient: Ingredient, host: SettingsHost): () => void {
	const { settings } = host.plugin;
	const row = setting.settingEl;
	row.addClass("cookbook-list-row");
	setting.setDesc("");
	const control = setting.controlEl;

	const toggle = control.createEl("button", { cls: "clickable-icon cookbook-row-toggle" });

	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-name");
		t.setPlaceholder("Ingredient name")
			.setValue(ingredient.name)
			.onChange((value) => {
				ingredient.name = value;
				host.saveSoon();
			});
		// Store aisles name ingredients: follow a rename once editing ends
		let nameBefore = ingredient.name;
		t.inputEl.addEventListener("focus", () => {
			if (ingredient.name.trim()) nameBefore = ingredient.name;
		});
		t.inputEl.addEventListener("change", () => {
			if (!ingredient.name.trim()) return;
			if (ingredient.name !== nameBefore) renameIngredient(settings, nameBefore, ingredient.name);
			nameBefore = ingredient.name;
		});
	});

	const summary = control.createDiv({ cls: "cookbook-row-summary" });
	const summaryText = summary.createSpan({ cls: "cookbook-row-preview" });
	const updateSummary = () => {
		summaryText.setText(describe(ingredient));
		summaryText.toggleClass("is-uncategorized", !ingredient.category);
	};
	updateSummary();

	// The detail is built on first open: most rows are never opened
	const detail = control.createDiv({ cls: "cookbook-row-detail" });
	const fields: KeywordField[] = [];
	const buildDetail = () => {
		if (detail.childElementCount > 0) return;

		const categoryRow = detail.createDiv({ cls: "cookbook-row-field cookbook-row-inline" });
		categoryRow.createSpan({ cls: "cookbook-row-field-label", text: "Category" });
		const dropdown = new DropdownComponent(categoryRow);
		dropdown.addOption("", "Uncategorized");
		for (const c of settings.shoppingCategories) dropdown.addOption(c.name, c.name);
		// A category deleted since keeps showing until changed
		if (ingredient.category && !settings.shoppingCategories.some((c) => c.name === ingredient.category)) {
			dropdown.addOption(ingredient.category, `${ingredient.category} (deleted)`);
		}
		dropdown.addOption(NEW_CATEGORY, "New category…");
		dropdown.setValue(ingredient.category).onChange((value) => {
			if (value === NEW_CATEGORY) {
				// Put the dropdown back until a name is given
				dropdown.setValue(ingredient.category);
				new TextPromptModal(host.app, {
					title: "New category",
					placeholder: "Name, such as International",
					submitLabel: "Add category",
					validate: (name) =>
						settings.shoppingCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())
							? "There's already a category with that name."
							: null,
					onSubmit: (name) => {
						settings.shoppingCategories.push({ name });
						ingredient.category = name;
						host.saveNow();
						host.refresh();
					},
				}).open();
				return;
			}
			ingredient.category = value;
			updateSummary();
			host.saveSoon();
		});

		fields.push(
			keywordField(detail, {
				label: "Dietary groups",
				placeholder: "None. Choose a group",
				get: () => ingredient.groups,
				set: (value) => {
					ingredient.groups = value;
					updateSummary();
					host.saveSoon();
				},
				choices: {
					app: host.app,
					items: () => settings.ingredientGroups.map((g) => g.name),
					noun: "dietary group",
				},
			}),
			keywordField(detail, {
				label: "Other names",
				placeholder: "Other words for it, e.g. green onion, spring onion",
				get: () => ingredient.otherNames,
				set: (value) => {
					ingredient.otherNames = value;
					host.saveSoon();
				},
			}),
		);

		const stapleRow = detail.createDiv({ cls: "cookbook-row-field cookbook-row-inline" });
		const stapleLabel = stapleRow.createSpan({ cls: "cookbook-row-field-label", text: "Staple" });
		stapleLabel.title = "In nearly every recipe, so it's left out when finding recipes that cook well together";
		new ToggleComponent(stapleRow).setValue(!!ingredient.staple).onChange((value) => {
			if (value) ingredient.staple = true;
			else delete ingredient.staple;
			updateSummary();
			host.saveSoon();
		});
	};

	// Toggled in place rather than via refresh(), which would rebuild the page
	const apply = () => {
		const open = expanded.has(ingredient);
		if (open) buildDetail();
		row.toggleClass("is-expanded", open);
		setIcon(toggle, open ? "chevron-down" : "chevron-right");
		toggle.setAttr("aria-expanded", String(open));
		toggle.setAttr("aria-label", `${open ? "Hide" : "Show"} details for ${ingredient.name}`);
	};
	const setOpen = (open: boolean) => {
		if (open) expanded.add(ingredient);
		else expanded.delete(ingredient);
		apply();
	};
	toggle.addEventListener("click", () => setOpen(!expanded.has(ingredient)));
	summary.addEventListener("click", () => setOpen(true));
	apply();

	return () => fields.forEach((f) => f.destroy());
}
