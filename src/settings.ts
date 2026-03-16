import { App, PluginSettingTab, Setting } from "obsidian";
import CookbookPlugin from "./main";
import { FolderSuggest } from "./utils/suggesters/FolderSuggester";
import type { ShoppingCategory } from "./types";

export interface CookbookSettings {
	propsToShow: string[];
	recipesFolder?: string;
	recipesTag?: string;
	shoppingCategories: ShoppingCategory[];
}

export const DEFAULT_SETTINGS: CookbookSettings = {
	propsToShow: ["title", "cover"],
	recipesFolder: ".",
	recipesTag: "#recipe",
	shoppingCategories: [
		{
			name: "Produce",
			keywords: [
				"carrot", "onion", "garlic", "tomato", "lettuce",
				"spinach", "potato", "pepper", "cucumber", "celery",
				"mushroom", "broccoli", "cauliflower", "cabbage",
				"leek", "herb", "basil", "parsley", "cilantro",
				"thyme", "rosemary", "sage", "mint", "chive", "lemon",
				"lime", "apple", "banana", "berry", "berries",
			],
		},
		{
			name: "Dairy & Eggs",
			keywords: [
				"milk", "cheese", "butter", "cream", "yogurt",
				"egg", "cheddar", "mozzarella", "parmesan", "brie",
				"sour cream", "crème fraîche",
			],
		},
		{
			name: "Meat & Fish",
			keywords: [
				"chicken", "beef", "pork", "lamb", "turkey",
				"bacon", "sausage", "mince", "steak", "salmon",
				"tuna", "cod", "shrimp", "prawn", "fish",
			],
		},
		{
			name: "Pantry",
			keywords: [
				"flour", "sugar", "salt", "oil", "vinegar",
				"sauce", "pasta", "rice", "bread", "stock",
				"broth", "tin", "can", "spice", "cumin",
				"paprika", "turmeric", "cinnamon", "honey",
				"soy sauce", "olive oil",
			],
		},
	],
};

export class CookbookSettingTab extends PluginSettingTab {
	plugin: CookbookPlugin;

	constructor(app: App, plugin: CookbookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Properties to Display")
			.setDesc(
				"Frontmatter properties to show in the recipe grid. Comma-separated list.",
			)
			.addText((text) =>
				text
					.setPlaceholder("title, cook-time, cover")
					.setValue(this.plugin.settings.propsToShow.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.propsToShow = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Folder for Recipes")
			.setDesc("Path to the folder where your recipes are stored.")
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("Defaults to entire vault")
					.setValue(this.plugin.settings.recipesFolder ?? ".")
					.onChange(async (value) => {
						this.plugin.settings.recipesFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Tag for Recipes")
			.setDesc("The tag that identifies recipe files.")
			.addText((text) =>
				text
					.setPlaceholder("Defaults to #recipe")
					.setValue(this.plugin.settings.recipesTag ?? "#recipe")
					.onChange(async (value) => {
						const tag = (value ?? "#recipe").trim();
						this.plugin.settings.recipesTag = tag.startsWith("#")
							? tag
							: `#${tag}`;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "Shopping List Categories" });
		containerEl.createEl("p", {
			text: "Define categories to group shopping list items. Items are matched to the first category whose keywords appear in the item text. Drag categories in the shopping list view to reorder them.",
			cls: "setting-item-description",
		});

		const categoriesContainer = containerEl.createDiv();

		const renderCategories = () => {
			categoriesContainer.empty();

			this.plugin.settings.shoppingCategories.forEach((cat, idx) => {
				const setting = new Setting(categoriesContainer)
					.setName(`Category ${idx + 1}`)
					.addText((t) =>
						t
							.setPlaceholder("Name (e.g. Produce)")
							.setValue(cat.name)
							.onChange(async (v) => {
								this.plugin.settings.shoppingCategories[idx]!.name = v;
								await this.plugin.saveSettings();
							}),
					)
					.addText((t) => {
						t.inputEl.style.width = "220px";
						return t
							.setPlaceholder("Keywords, comma-separated")
							.setValue(cat.keywords.join(", "))
							.onChange(async (v) => {
								this.plugin.settings.shoppingCategories[idx]!.keywords = v
									.split(",")
									.map((s) => s.trim())
									.filter((s) => s.length > 0);
								await this.plugin.saveSettings();
							});
					})
					.addButton((b) =>
						b
							.setIcon("trash")
							.setTooltip("Remove")
							.onClick(async () => {
								this.plugin.settings.shoppingCategories.splice(idx, 1);
								await this.plugin.saveSettings();
								renderCategories();
							}),
					);

				if (idx > 0) {
					setting.addButton((b) =>
						b
							.setIcon("arrow-up")
							.setTooltip("Move up")
							.onClick(async () => {
								const cats = this.plugin.settings.shoppingCategories;
								const a = cats[idx - 1]!;
								const b = cats[idx]!;
								cats[idx - 1] = b;
								cats[idx] = a;
								await this.plugin.saveSettings();
								renderCategories();
							}),
					);
				}
				if (idx < this.plugin.settings.shoppingCategories.length - 1) {
					setting.addButton((b) =>
						b
							.setIcon("arrow-down")
							.setTooltip("Move down")
							.onClick(async () => {
								const cats = this.plugin.settings.shoppingCategories;
								const a = cats[idx]!;
								const b = cats[idx + 1]!;
								cats[idx] = b;
								cats[idx + 1] = a;
								await this.plugin.saveSettings();
								renderCategories();
							}),
					);
				}
			});

			new Setting(categoriesContainer).addButton((b) =>
				b
					.setButtonText("+ Add Category")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.shoppingCategories.push({
							name: "",
							keywords: [],
						});
						await this.plugin.saveSettings();
						renderCategories();
					}),
			);
		};

		renderCategories();
	}
}
