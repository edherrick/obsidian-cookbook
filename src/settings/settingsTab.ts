import { App, PluginSettingTab, Setting, debounce, setIcon } from "obsidian";
import type CookbookPlugin from "../main";
import { PathSuggest } from "../utils/suggesters/PathSuggest";
import type { KeywordGroup } from "../types";
import { cloneDefaultSettings } from "./index";

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
		options: { namePlaceholder: string; addLabel: string; reorderable?: boolean },
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
			kwInput.placeholder = "Keywords, comma-separated";
			kwInput.value = item.keywords.join(", ");
			kwInput.addEventListener("input", () => {
				items[idx]!.keywords = kwInput.value
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				this.saveDebounced();
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
			{ namePlaceholder: "Name (e.g. Dairy)", addLabel: "Add group" },
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
	}
}
