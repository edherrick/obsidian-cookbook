import { App, PluginSettingTab, Setting } from "obsidian";
import CookbookPlugin from "./main";
import { FolderSuggest } from "./utils/suggesters/FolderSuggester";

export interface CookbookSettings {
	propsToShow: string[];
	recipesFolder?: string;
	recipesTag?: string;
}

export const DEFAULT_SETTINGS: CookbookSettings = {
	propsToShow: ["title", "cover"],
	recipesFolder: ".",
	recipesTag: "#recipe",
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
				"List of all properties you wish to display in the cookbook recipe grid. As comma seperated list.",
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
			});

		// .addText((text) =>
		// 	text
		// 		.setPlaceholder("Defaults to all files in vault")
		// 		.setValue(this.plugin.settings.recipesFolder ?? ".")
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.recipesFolder = value;
		// 			await this.plugin.saveSettings();
		// 		}),
		// );

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
	}
}
