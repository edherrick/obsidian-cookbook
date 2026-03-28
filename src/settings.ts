import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import CookbookPlugin from "./main";
import { FolderSuggest } from "./utils/suggesters/FolderSuggester";
import { FileFolderSuggester } from "./utils/suggesters/FileFolderSuggester";
import type { ShoppingCategory, IngredientGroup } from "./types";

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
}

export const DEFAULT_SETTINGS: CookbookSettings = {
	propsToShow: ["title"],
	coverProp: "cover",
	recipesFolder: ".",
	recipesTag: "#recipe",
	cookSoonProp: "cook-soon",
	ignorePaths: [],
	hideCheckedItems: false,
	ingredientGroups: [
		{ name: "Dairy",          keywords: ["milk", "butter", "cream", "cheese", "yogurt", "parmesan", "mozzarella", "cheddar", "brie", "feta", "ricotta", "ghee", "creme fraiche", "sour cream", "mascarpone", "whipping cream", "double cream", "single cream", "half and half", "cream cheese"] },
		{ name: "Meat & Poultry", keywords: ["chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "mince", "steak", "duck", "veal", "ham", "pancetta", "chorizo", "salami", "pepperoni", "brisket", "venison", "lard"] },
		{ name: "Fish & Seafood", keywords: ["salmon", "tuna", "cod", "shrimp", "prawn", "fish", "anchovy", "sardine", "crab", "lobster", "scallop", "squid", "halibut", "tilapia", "sea bass", "haddock", "mackerel", "trout", "clam", "mussel", "oyster"] },
		{ name: "Eggs",           keywords: ["egg", "eggs"] },
		{ name: "Nuts",           keywords: ["almond", "walnut", "pecan", "pine nut", "cashew", "peanut", "pistachio", "hazelnut", "macadamia", "nut butter", "peanut butter"] },
		{ name: "Gluten",         keywords: ["flour", "wheat", "bread", "pasta", "noodle", "barley", "rye", "couscous", "breadcrumb", "panko", "semolina", "spelt", "bulgur"] },
	],
	shoppingCategories: [
		{
			name: "Produce",
			keywords: [
				"carrot",
				"onion",
				"garlic",
				"tomato",
				"lettuce",
				"spinach",
				"potato",
				"pepper",
				"cucumber",
				"celery",
				"mushroom",
				"broccoli",
				"cauliflower",
				"cabbage",
				"leek",
				"herb",
				"basil",
				"parsley",
				"cilantro",
				"thyme",
				"rosemary",
				"sage",
				"mint",
				"chive",
				"lemon",
				"lime",
				"apple",
				"banana",
				"berry",
				"berries",
				"orange",
				"zucchini",
				"courgette",
				"squash",
				"avocado",
				"mango",
				"peach",
				"pear",
				"grape",
				"strawberry",
				"asparagus",
				"corn",
				"pea",
				"green bean",
				"beetroot",
				"beet",
				"ginger",
				"scallion",
				"spring onion",
				"kale",
				"arugula",
				"rocket",
				"fennel",
				"shallot",
				"radish",
				"artichoke",
				"eggplant",
				"aubergine",
				"sweet potato",
				"bok choy",
				"watercress",
				"endive",
			],
		},
		{
			name: "Dairy & Eggs",
			keywords: [
				"milk",
				"cheese",
				"butter",
				"cream",
				"yogurt",
				"egg",
				"cheddar",
				"mozzarella",
				"parmesan",
				"brie",
				"sour cream",
				"crème fraîche",
				"cream cheese",
				"ricotta",
				"feta",
				"gouda",
				"goat cheese",
				"half and half",
				"ghee",
				"whipping cream",
				"double cream",
				"single cream",
				"mascarpone",
				"cottage cheese",
				"pecorino",
			],
		},
		{
			name: "Meat & Fish",
			keywords: [
				"chicken",
				"beef",
				"pork",
				"lamb",
				"turkey",
				"bacon",
				"sausage",
				"mince",
				"steak",
				"salmon",
				"tuna",
				"cod",
				"shrimp",
				"prawn",
				"fish",
				"duck",
				"veal",
				"ham",
				"pancetta",
				"anchovy",
				"sardine",
				"crab",
				"lobster",
				"scallop",
				"squid",
				"venison",
				"chorizo",
				"salami",
				"pepperoni",
				"brisket",
				"ribs",
				"fillet",
				"halibut",
				"tilapia",
				"sea bass",
				"haddock",
				"mackerel",
				"trout",
			],
		},
		{
			name: "Pantry",
			keywords: [
				"flour",
				"sugar",
				"salt",
				"oil",
				"vinegar",
				"sauce",
				"pasta",
				"rice",
				"stock",
				"broth",
				"tin",
				"can",
				"spice",
				"cumin",
				"paprika",
				"turmeric",
				"cinnamon",
				"honey",
				"soy sauce",
				"olive oil",
				"lentil",
				"chickpea",
				"black bean",
				"kidney bean",
				"oat",
				"noodle",
				"cornstarch",
				"cornflour",
				"baking powder",
				"baking soda",
				"bicarbonate",
				"yeast",
				"cocoa",
				"chocolate",
				"jam",
				"mustard",
				"ketchup",
				"mayo",
				"mayonnaise",
				"tahini",
				"miso",
				"wine",
				"beer",
				"chili",
				"chilli",
				"curry",
				"bay leaf",
				"breadcrumb",
				"panko",
				"tomato paste",
				"coconut milk",
				"vegetable oil",
				"sesame oil",
				"fish sauce",
				"worcestershire",
				"hot sauce",
				"maple syrup",
				"peanut butter",
				"almond",
				"walnut",
				"pecan",
				"pine nut",
				"cashew",
				"raisin",
				"dried fruit",
				"quinoa",
				"couscous",
				"barley",
			],
		},
		{
			name: "Frozen",
			keywords: [
				"frozen",
				"ice cream",
				"sorbet",
				"gelato",
				"frozen peas",
				"frozen corn",
				"frozen spinach",
				"frozen berries",
				"frozen fish",
				"frozen chicken",
				"edamame",
				"frozen pastry",
				"puff pastry",
				"shortcrust pastry",
				"frozen chips",
				"french fries",
			],
		},
		{
			name: "Bakery",
			keywords: [
				"bread",
				"loaf",
				"baguette",
				"croissant",
				"roll",
				"bun",
				"sourdough",
				"brioche",
				"ciabatta",
				"focaccia",
				"bagel",
				"muffin",
				"scone",
				"tortilla",
				"wrap",
				"pitta",
				"pita",
				"naan",
				"flatbread",
				"crumpet",
				"english muffin",
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

	private renderCategoryEditor(
		container: HTMLElement,
		getItems: () => ShoppingCategory[],
		options: { namePlaceholder: string; addLabel: string; reorderable?: boolean },
	): void {
		container.empty();
		const items = getItems();
		const rerender = () => this.renderCategoryEditor(container, getItems, options);

		const mkBtn = (parent: HTMLElement, icon: string, tooltip: string, danger = false) => {
			const btn = parent.createEl("button");
			btn.title = tooltip;
			if (danger) btn.addClass("is-danger");
			requestAnimationFrame(() => setIcon(btn, icon));
			return btn;
		};

		items.forEach((item, idx) => {
			const row = container.createDiv({ cls: "cookbook-cat-row" });
			const fields = row.createDiv({ cls: "cookbook-cat-fields" });

			const nameInput = fields.createEl("input", { type: "text" });
			nameInput.className = "cookbook-cat-name";
			nameInput.placeholder = options.namePlaceholder;
			nameInput.value = item.name;
			nameInput.addEventListener("input", () => {
				items[idx]!.name = nameInput.value;
				void this.plugin.saveSettings();
			});

			const kwInput = fields.createEl("input", { type: "text" });
			kwInput.className = "cookbook-cat-keywords";
			kwInput.placeholder = "Keywords, comma-separated";
			kwInput.value = item.keywords.join(", ");
			kwInput.addEventListener("input", () => {
				items[idx]!.keywords = kwInput.value
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				void this.plugin.saveSettings();
			});

			const actions = row.createDiv({ cls: "cookbook-cat-actions" });

			if (options.reorderable) {
				if (idx > 0) {
					mkBtn(actions, "arrow-up", "Move up").addEventListener("click", () => {
						[items[idx - 1], items[idx]] = [items[idx]!, items[idx - 1]!];
						void this.plugin.saveSettings();
						rerender();
					});
				}
				if (idx < items.length - 1) {
					mkBtn(actions, "arrow-down", "Move down").addEventListener("click", () => {
						[items[idx], items[idx + 1]] = [items[idx + 1]!, items[idx]!];
						void this.plugin.saveSettings();
						rerender();
					});
				}
			}

			mkBtn(actions, "trash", "Remove", true).addEventListener("click", () => {
				items.splice(idx, 1);
				void this.plugin.saveSettings();
				rerender();
			});
		});

		new Setting(container).addButton((b) =>
			b.setButtonText(options.addLabel).setCta().onClick(() => {
				items.push({ name: "", keywords: [] });
				void this.plugin.saveSettings();
				rerender();
			}),
		);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Properties to display")
			.setDesc(
				"Frontmatter properties to show in the recipe grid. Comma-separated list.",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("title, cook-time, cover")
					.setValue(this.plugin.settings.propsToShow.join(", "))
					.onChange((value) => {
						this.plugin.settings.propsToShow = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Folder for recipes")
			.setDesc("Path to the folder where your recipes are stored.")
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("Defaults to entire vault")
					.setValue(
						this.plugin.settings.recipesFolder === "." || !this.plugin.settings.recipesFolder
							? ""
							: this.plugin.settings.recipesFolder,
					)
					.onChange((value) => {
						this.plugin.settings.recipesFolder = value.trim() || ".";
						void this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Tag for recipes")
			.setDesc("The tag that identifies recipe files.")
			.addText((text) =>
				text
					.setPlaceholder("Defaults to #recipe")
					.setValue(this.plugin.settings.recipesTag ?? "#recipe")
					.onChange((value) => {
						const tag = (value ?? "#recipe").trim();
						this.plugin.settings.recipesTag = tag.startsWith("#")
							? tag
							: `#${tag}`;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Cook-soon property")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"The frontmatter property used to mark recipes as cook-soon. Change this if your vault uses a different key (e.g. make-soon).",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("cook-soon")
					.setValue(this.plugin.settings.cookSoonProp)
					.onChange((value) => {
						this.plugin.settings.cookSoonProp = value.trim() || "cook-soon";
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Cover image property")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"The frontmatter property used as the recipe cover image. Change this if your vault uses a different key (e.g. thumbnail, banner).",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("cover")
					.setValue(this.plugin.settings.coverProp)
					.onChange((value) => {
						this.plugin.settings.coverProp = value.trim() || "cover";
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ignored files and folders")
			.setDesc(
				"Files or folders to exclude from the recipe library. Folders exclude all files inside them.",
			);

		const ignoreContainer = containerEl.createDiv({ cls: "cookbook-ignore-container" });

		const renderIgnoreChips = () => {
			ignoreContainer.empty();

			const chips = ignoreContainer.createDiv({ cls: "cookbook-ignore-chips" });
			for (const p of this.plugin.settings.ignorePaths) {
				const chip = chips.createDiv({ cls: "cookbook-ignore-chip" });
				chip.createSpan({ text: p });
				const removeBtn = chip.createEl("button", { text: "✕" });
				removeBtn.title = "Remove";
				removeBtn.addEventListener("click", () => {
					this.plugin.settings.ignorePaths =
						this.plugin.settings.ignorePaths.filter((x) => x !== p);
					void this.plugin.saveSettings();
					renderIgnoreChips();
				});
			}

			const addRow = ignoreContainer.createDiv({ cls: "cookbook-ignore-add" });
			const input = addRow.createEl("input", { type: "text" });
			input.placeholder = "Add file or folder…";
			new FileFolderSuggester(this.app, input);

			const addBtn = addRow.createEl("button", { text: "Add" });
			const doAdd = () => {
				const val = input.value.trim();
				if (!val || this.plugin.settings.ignorePaths.includes(val)) {
					input.value = "";
					return;
				}
				this.plugin.settings.ignorePaths = [...this.plugin.settings.ignorePaths, val];
				void this.plugin.saveSettings();
				renderIgnoreChips();
			};
			addBtn.addEventListener("click", doAdd);
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") { e.preventDefault(); doAdd(); }
			});
		};

		renderIgnoreChips();

		if (!containerEl.doc.getElementById("cookbook-ignore-styles")) {
			const style = containerEl.doc.createElement("style");
			style.id = "cookbook-ignore-styles";
			style.textContent = `
				.cookbook-ignore-chips {
					display: flex;
					flex-wrap: wrap;
					gap: 4px;
					margin-bottom: 6px;
				}
				.cookbook-ignore-chip {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					padding: 2px 8px;
					background: var(--background-secondary-alt);
					border: 1px solid var(--background-modifier-border);
					border-radius: 12px;
					font-size: 0.85em;
				}
				.cookbook-ignore-chip button {
					background: none;
					border: none;
					cursor: pointer;
					color: var(--text-muted);
					padding: 0;
					font-size: 0.8em;
					line-height: 1;
				}
				.cookbook-ignore-chip button:hover { color: var(--text-error); }
				.cookbook-ignore-add {
					display: flex;
					gap: 6px;
					align-items: center;
				}
				.cookbook-ignore-add input {
					flex: 1;
					font-size: 0.88em;
				}
			`;
			containerEl.doc.head.appendChild(style);
		}

		new Setting(containerEl)
			.setName("Preferred volume unit")
			.setDesc(
				"Unit to display when aggregating volume ingredients across recipes. Auto uses whichever unit appears first.",
			)
			.addDropdown((dd) => {
				dd.addOption("", "Auto");
				for (const u of ["ml", "tsp", "tbsp", "cups", "pt", "l"])
					dd.addOption(u, u);
				dd.setValue(this.plugin.settings.preferredVolumeUnit ?? "");
				dd.onChange((value) => {
					this.plugin.settings.preferredVolumeUnit =
						value || undefined;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Preferred weight unit")
			.setDesc(
				"Unit to display when aggregating weight ingredients across recipes. Auto uses whichever unit appears first.",
			)
			.addDropdown((dd) => {
				dd.addOption("", "Auto");
				for (const u of ["g", "kg", "oz", "lb"]) dd.addOption(u, u);
				dd.setValue(this.plugin.settings.preferredWeightUnit ?? "");
				dd.onChange((value) => {
					this.plugin.settings.preferredWeightUnit =
						value || undefined;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Hide checked items")
			.setDesc("When enabled, items disappear from the shopping list as soon as they are checked off.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideCheckedItems)
					.onChange((value) => {
						this.plugin.settings.hideCheckedItems = value;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ingredient groups")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Named groups used to filter recipes by dietary need (e.g. exclude dairy, gluten). Each group's keywords are matched against recipe ingredients.",
			)
			.setHeading();

		const ingredientGroupsContainer = containerEl.createDiv();
		this.renderCategoryEditor(
			ingredientGroupsContainer,
			() => this.plugin.settings.ingredientGroups,
			{ namePlaceholder: "Name (e.g. Dairy)", addLabel: "Add group" },
		);

		new Setting(containerEl)
			.setName("Shopping list categories")
			.setDesc(
				"Define categories to group shopping list items. Items are matched to the first category whose keywords appear in the item text. Drag categories in the shopping list view to reorder them.",
			)
			.setHeading();

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
		this.renderCategoryEditor(
			categoriesContainer,
			() => this.plugin.settings.shoppingCategories,
			{ namePlaceholder: "Name (e.g. Produce)", addLabel: "Add category", reorderable: true },
		);
	}
}
