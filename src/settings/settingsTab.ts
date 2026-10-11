import { App, PluginSettingTab, Setting, debounce, setIcon } from "obsidian";
import type CookbookPlugin from "../main";
import { PathSuggest } from "../utils/suggesters/PathSuggest";
import type { IngredientGroup, KeywordGroup, StoreLayout } from "../types";
import { cloneDefaultSettings } from "./index";
import { renderIngredientNamesPanel } from "./ingredientNamesPanel";

function commaList(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Keystrokes shouldn't each cost a disk read + write. */
const SAVE_DEBOUNCE_MS = 400;

export class CookbookSettingTab extends PluginSettingTab {
	plugin: CookbookPlugin;
	private readonly saveDebounced: () => void;

	constructor(app: App, plugin: CookbookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.saveDebounced = debounce(() => void this.plugin.saveSettings(), SAVE_DEBOUNCE_MS, false);
	}

	/** Edits any named keyword list — shopping categories and ingredient groups alike. */
	private renderCategoryEditor(
		container: HTMLElement,
		getItems: () => KeywordGroup[],
		options: {
			namePlaceholder: string;
			keywordsPlaceholder?: string;
			addLabel: string;
			reorderable?: boolean;
			/** Dietary groups only: a second list of terms that must NOT match. */
			excludable?: boolean;
		},
	): void {
		container.empty();
		const items = getItems();
		const rerender = () => this.renderCategoryEditor(container, getItems, options);

		const mkBtn = (parent: HTMLElement, icon: string, tooltip: string, danger = false) => {
			const btn = parent.createEl("button");
			btn.title = tooltip;
			if (danger) btn.addClass("is-danger");
			setIcon(btn, icon);
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
				this.saveDebounced();
			});

			const kwInput = fields.createEl("input", { type: "text" });
			kwInput.className = "cookbook-cat-keywords";
			kwInput.placeholder = options.keywordsPlaceholder ?? "Keywords, comma-separated";
			kwInput.value = item.keywords.join(", ");
			kwInput.addEventListener("input", () => {
				items[idx]!.keywords = kwInput.value
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				this.saveDebounced();
			});

			if (options.excludable) {
				const group = item as IngredientGroup;
				const exInput = fields.createEl("input", { type: "text" });
				exInput.className = "cookbook-cat-excludes";
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				exInput.placeholder = "Not, e.g. coconut milk";
				exInput.title =
					"Terms that look like a match but are not, such as coconut milk in the dairy group";
				exInput.value = group.excludeKeywords?.join(", ") ?? "";
				exInput.addEventListener("input", () => {
					const parsed = exInput.value
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					(items[idx] as IngredientGroup).excludeKeywords =
						parsed.length > 0 ? parsed : undefined;
					this.saveDebounced();
				});
			}

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
			b
				.setButtonText(options.addLabel)
				.setCta()
				.onClick(() => {
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
			.setDesc("Frontmatter properties to show in the recipe grid. Comma-separated list.")
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
						this.saveDebounced();
					}),
			);

		new Setting(containerEl)
			.setName("Folder for recipes")
			.setDesc("Path to the folder where your recipes are stored.")
			.addSearch((search) => {
				new PathSuggest(this.app, search.inputEl, "folder");
				search
					.setPlaceholder("Defaults to entire vault")
					.setValue(
						this.plugin.settings.recipesFolder === "." || !this.plugin.settings.recipesFolder
							? ""
							: this.plugin.settings.recipesFolder,
					)
					.onChange((value) => {
						this.plugin.settings.recipesFolder = value.trim() || ".";
						this.saveDebounced();
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
						this.plugin.settings.recipesTag = tag.startsWith("#") ? tag : `#${tag}`;
						this.saveDebounced();
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
						this.saveDebounced();
					}),
			);

		new Setting(containerEl)
			.setName("Cover image property")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"The frontmatter property used as the recipe cover image. Accepts a URL, a vault path, or a wikilink. Change this if your vault uses a different key (e.g. thumbnail, banner).",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("cover")
					.setValue(this.plugin.settings.coverProp)
					.onChange((value) => {
						this.plugin.settings.coverProp = value.trim() || "cover";
						this.saveDebounced();
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
				const removeBtn = chip.createEl("button");
				removeBtn.title = "Remove";
				setIcon(removeBtn, "x");
				removeBtn.addEventListener("click", () => {
					this.plugin.settings.ignorePaths = this.plugin.settings.ignorePaths.filter(
						(x) => x !== p,
					);
					void this.plugin.saveSettings();
					renderIgnoreChips();
				});
			}

			const addRow = ignoreContainer.createDiv({ cls: "cookbook-ignore-add" });
			const input = addRow.createEl("input", { type: "text" });
			input.placeholder = "Add file or folder…";
			new PathSuggest(this.app, input, "any");

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
				if (e.key === "Enter") {
					e.preventDefault();
					doAdd();
				}
			});
		};

		renderIgnoreChips();

		new Setting(containerEl)
			.setName("Preferred volume unit")
			.setDesc(
				"Unit to display when aggregating volume ingredients across recipes. Auto uses whichever unit appears first.",
			)
			.addDropdown((dd) => {
				dd.addOption("", "Auto");
				for (const u of ["ml", "tsp", "tbsp", "cups", "pt", "l"]) dd.addOption(u, u);
				dd.setValue(this.plugin.settings.preferredVolumeUnit ?? "");
				dd.onChange((value) => {
					this.plugin.settings.preferredVolumeUnit = value || undefined;
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
					this.plugin.settings.preferredWeightUnit = value || undefined;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Hide checked items")
			.setDesc(
				"When enabled, items disappear from the shopping list as soon as they are checked off.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.hideCheckedItems).onChange((value) => {
					this.plugin.settings.hideCheckedItems = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Shopping list vault file")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"If set, the shopping list is saved to this markdown file in your vault instead of plugin storage. Leave empty to use internal storage.",
			)
			.addSearch((search) => {
				new PathSuggest(this.app, search.inputEl, "any");
				search
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("e.g. shopping-list.md")
					.setValue(this.plugin.settings.shoppingListFilePath ?? "")
					.onChange((value) => {
						this.plugin.settings.shoppingListFilePath = value.trim() || undefined;
						this.saveDebounced();
					});
			});

		new Setting(containerEl)
			.setName("Ingredient groups")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Named groups used to filter recipes by dietary need (e.g. exclude dairy, gluten). Each group's keywords are matched against recipe ingredients.",
			)
			.setHeading()
			.addButton((b) =>
				b.setButtonText("Restore defaults").onClick(() => {
					this.plugin.settings.ingredientGroups = cloneDefaultSettings().ingredientGroups;
					void this.plugin.saveSettings();
					this.display();
				}),
			);

		const ingredientGroupsContainer = containerEl.createDiv();
		this.renderCategoryEditor(
			ingredientGroupsContainer,
			() => this.plugin.settings.ingredientGroups,
			{ namePlaceholder: "Name (e.g. Dairy)", addLabel: "Add group", excludable: true },
		);

		new Setting(containerEl)
			.setName("Shopping list categories")
			.setDesc(
				"Define categories to group shopping list items. Each item goes to the category with the most specific matching keyword. Drag categories in the shopping list view to reorder them.",
			)
			.setHeading()
			.addButton((b) =>
				b.setButtonText("Restore defaults").onClick(() => {
					this.plugin.settings.shoppingCategories = cloneDefaultSettings().shoppingCategories;
					void this.plugin.saveSettings();
					this.display();
				}),
			);

		const categoriesContainer = containerEl.createDiv();
		this.renderCategoryEditor(
			categoriesContainer,
			() => this.plugin.settings.shoppingCategories,
			{ namePlaceholder: "Name (e.g. Produce)", addLabel: "Add category", reorderable: true },
		);

		new Setting(containerEl)
			.setName("Store layouts")
			.setDesc(
				"A route through one shop: the order its aisles are walked. Reorder a route by dragging categories in the shopping list itself — switching shops there re-sorts the list.",
			)
			.setHeading();

		const storesContainer = containerEl.createDiv();
		this.renderStoreEditor(storesContainer);

		this.renderCookingSettings(containerEl);
	}

	/** Cook-together sessions, prep techniques, ingredient aliases and overlap. */
	private renderCookingSettings(containerEl: HTMLElement): void {
		const { settings } = this.plugin;

		new Setting(containerEl).setName("Cooking sessions").setHeading();

		new Setting(containerEl)
			.setName("Cook-together property")
			.setDesc("The frontmatter property that marks recipes to cook in one session.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("cook-together")
					.setValue(settings.cookTogetherProp)
					.onChange((value) => {
						settings.cookTogetherProp = value.trim() || "cook-together";
						this.saveDebounced();
					}),
			);

		new Setting(containerEl)
			.setName("Session folder")
			.setDesc("Where cooking session notes are written. One note per day, regenerated in place.")
			.addSearch((search) => {
				new PathSuggest(this.app, search.inputEl, "folder");
				search
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("recipes/cook sessions")
					.setValue(settings.cookSessionFolder)
					.onChange((value) => {
						settings.cookSessionFolder = value.trim();
						this.saveDebounced();
					});
			});

		new Setting(containerEl)
			.setName("Prep techniques")
			.setDesc(
				"Tag a technique on an ingredient line with #prefix/name, e.g. #prep/dice. Words listed here count as the technique on untagged lines. The order is the order of the prep list in a cooking session.",
			)
			.setHeading()
			.addButton((b) =>
				b.setButtonText("Restore defaults").onClick(() => {
					settings.techniques = cloneDefaultSettings().techniques;
					void this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Technique tag prefix")
			.setDesc("The parent tag for techniques. Changing it does not rewrite existing tags.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("prep")
					.setValue(settings.techniqueTagPrefix)
					.onChange((value) => {
						settings.techniqueTagPrefix = value.replace(/^#/, "").replace(/\/+$/, "").trim() || "prep";
						this.saveDebounced();
					}),
			);

		const techniquesContainer = containerEl.createDiv();
		this.renderCategoryEditor(techniquesContainer, () => settings.techniques, {
			namePlaceholder: "Name (e.g. dice)",
			keywordsPlaceholder: "Words that mean it, e.g. diced, cubed",
			addLabel: "Add technique",
			reorderable: true,
		});

		new Setting(containerEl)
			.setName("Ingredient aliases")
			.setDesc(
				"Names that mean the same ingredient. Lines using any of them merge on the shopping list, count as overlap and match ingredient filters.",
			)
			.setHeading()
			.addButton((b) =>
				b.setButtonText("Restore defaults").onClick(() => {
					settings.ingredientAliases = cloneDefaultSettings().ingredientAliases;
					void this.plugin.saveSettings();
					this.display();
				}),
			);

		const aliasesContainer = containerEl.createDiv();
		const renderAliases = () =>
			this.renderCategoryEditor(aliasesContainer, () => settings.ingredientAliases, {
				namePlaceholder: "Name (e.g. scallion)",
				keywordsPlaceholder: "Other names, e.g. green onion, spring onion",
				addLabel: "Add alias",
			});
		renderAliases();

		new Setting(containerEl)
			.setName("Ingredient names in your recipes")
			.setDesc("Find names that are really one ingredient and merge them into the aliases above.");
		renderIngredientNamesPanel(containerEl.createDiv(), this.plugin, renderAliases);

		new Setting(containerEl).setName("Overlap").setHeading();

		new Setting(containerEl)
			.setName("Staple ingredients")
			.setDesc(
				"Ingredients nearly every recipe uses. They are ignored when finding recipes that cook well together. Comma-separated.",
			)
			.addTextArea((text) =>
				text.setValue(settings.stapleIngredients.join(", ")).onChange((value) => {
					settings.stapleIngredients = commaList(value);
					this.saveDebounced();
				}),
			);

		new Setting(containerEl)
			.setName("Ignored aisles")
			.setDesc("Shopping categories whose ingredients don't count as overlap. Comma-separated.")
			.addText((text) =>
				text.setValue(settings.overlapIgnoreCategories.join(", ")).onChange((value) => {
					settings.overlapIgnoreCategories = commaList(value);
					this.saveDebounced();
				}),
			);
	}

	private renderStoreEditor(container: HTMLElement): void {
		container.empty();
		const { settings } = this.plugin;
		const rerender = () => this.renderStoreEditor(container);

		new Setting(container).setName("Active store").addDropdown((dd) => {
			for (const l of settings.storeLayouts) dd.addOption(l.name, l.name);
			dd.setValue(settings.activeStoreLayout ?? settings.storeLayouts[0]?.name ?? "");
			dd.onChange((value) => {
				settings.activeStoreLayout = value;
				void this.plugin.saveSettings();
			});
		});

		settings.storeLayouts.forEach((layout, idx) => {
			const row = container.createDiv({ cls: "cookbook-cat-row" });
			const fields = row.createDiv({ cls: "cookbook-cat-fields" });

			const nameInput = fields.createEl("input", { type: "text" });
			nameInput.className = "cookbook-cat-name";
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			nameInput.placeholder = "Name (e.g. Tesco Extra)";
			nameInput.value = layout.name;
			nameInput.addEventListener("input", () => {
				const previous = settings.storeLayouts[idx]!.name;
				settings.storeLayouts[idx]!.name = nameInput.value;
				if (settings.activeStoreLayout === previous) {
					settings.activeStoreLayout = nameInput.value;
				}
				this.saveDebounced();
			});

			fields.createSpan({
				cls: "cookbook-store-summary",
				text: `${layout.aisleOrder.length} aisles`,
			});

			const actions = row.createDiv({ cls: "cookbook-cat-actions" });

			const dup = actions.createEl("button");
			dup.title = "Duplicate";
			setIcon(dup, "copy");
			dup.addEventListener("click", () => {
				// A new shop is nearly always a tweak of a route you already walk
				settings.storeLayouts.splice(idx + 1, 0, {
					name: `${layout.name} copy`,
					aisleOrder: [...layout.aisleOrder],
				});
				void this.plugin.saveSettings();
				rerender();
			});

			const del = actions.createEl("button");
			del.title = "Remove";
			del.addClass("is-danger");
			setIcon(del, "trash");
			del.disabled = settings.storeLayouts.length <= 1;
			del.addEventListener("click", () => {
				const [removed] = settings.storeLayouts.splice(idx, 1);
				if (settings.activeStoreLayout === removed?.name) {
					settings.activeStoreLayout = settings.storeLayouts[0]?.name;
				}
				void this.plugin.saveSettings();
				rerender();
			});
		});

		new Setting(container).addButton((b) =>
			b
				.setButtonText("Add store")
				.setCta()
				.onClick(() => {
					const layout: StoreLayout = {
						name: "New store",
						aisleOrder: this.plugin.settings.shoppingCategories.map((c) => c.name),
					};
					this.plugin.settings.storeLayouts.push(layout);
					void this.plugin.saveSettings();
					rerender();
				}),
		);
	}
}
