import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
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

		// Inject scoped styles for the category rows once
		if (!containerEl.doc.getElementById("cookbook-cat-styles")) {
			const style = containerEl.doc.createElement("style");
			style.id = "cookbook-cat-styles";
			style.textContent = `
				.cookbook-cat-row {
					display: grid;
					grid-template-columns: 1fr auto;
					gap: 4px;
					padding: 6px 0;
					border-bottom: 1px solid var(--background-modifier-border);
				}
				.cookbook-cat-fields {
					display: flex;
					gap: 6px;
					flex-wrap: wrap;
					align-items: center;
				}
				.cookbook-cat-name {
					width: 130px;
					flex-shrink: 0;
				}
				.cookbook-cat-keywords {
					flex: 1;
					min-width: 160px;
				}
				.cookbook-cat-actions {
					display: flex;
					gap: 2px;
					align-items: center;
					flex-shrink: 0;
				}
				.cookbook-cat-actions button {
					padding: 2px 5px;
					cursor: pointer;
					background: none;
					border: 1px solid transparent;
					border-radius: 3px;
					color: var(--text-muted);
				}
				.cookbook-cat-actions button:hover {
					border-color: var(--background-modifier-border);
					color: var(--text-normal);
				}
				.cookbook-cat-actions .is-danger:hover {
					color: var(--text-error);
					border-color: var(--text-error);
				}
			`;
			containerEl.doc.head.appendChild(style);
		}

		const categoriesContainer = containerEl.createDiv();

		const renderCategories = () => {
			categoriesContainer.empty();

			const cats = this.plugin.settings.shoppingCategories;

			cats.forEach((cat, idx) => {
				const row = categoriesContainer.createDiv({ cls: "cookbook-cat-row" });

				// ── Fields (name + keywords) ──────────────────────────────
				const fields = row.createDiv({ cls: "cookbook-cat-fields" });

				const nameInput = fields.createEl("input", { type: "text" });
				nameInput.className = "cookbook-cat-name";
				nameInput.placeholder = "Name (e.g. Produce)";
				nameInput.value = cat.name;
				nameInput.addEventListener("input", async () => {
					this.plugin.settings.shoppingCategories[idx]!.name =
						nameInput.value;
					await this.plugin.saveSettings();
				});

				const kwInput = fields.createEl("input", { type: "text" });
				kwInput.className = "cookbook-cat-keywords";
				kwInput.placeholder = "Keywords, comma-separated";
				kwInput.value = cat.keywords.join(", ");
				kwInput.addEventListener("input", async () => {
					this.plugin.settings.shoppingCategories[idx]!.keywords =
						kwInput.value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
					await this.plugin.saveSettings();
				});

				// ── Action buttons ────────────────────────────────────────
				const actions = row.createDiv({ cls: "cookbook-cat-actions" });

				const mkBtn = (icon: string, tooltip: string, danger = false) => {
					const btn = actions.createEl("button");
					btn.title = tooltip;
					if (danger) btn.addClass("is-danger");
					setIcon(btn, icon);
					return btn;
				};

				if (idx > 0) {
					mkBtn("arrow-up", "Move up").addEventListener(
						"click",
						async () => {
							const a = cats[idx - 1]!;
							const b = cats[idx]!;
							cats[idx - 1] = b;
							cats[idx] = a;
							await this.plugin.saveSettings();
							renderCategories();
						},
					);
				}

				if (idx < cats.length - 1) {
					mkBtn("arrow-down", "Move down").addEventListener(
						"click",
						async () => {
							const a = cats[idx]!;
							const b = cats[idx + 1]!;
							cats[idx] = b;
							cats[idx + 1] = a;
							await this.plugin.saveSettings();
							renderCategories();
						},
					);
				}

				mkBtn("trash", "Remove", true).addEventListener(
					"click",
					async () => {
						this.plugin.settings.shoppingCategories.splice(idx, 1);
						await this.plugin.saveSettings();
						renderCategories();
					},
				);
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
