import { App, PluginSettingTab, Setting } from "obsidian";
import CookbookPlugin from "./main";

export interface CookbookSettings {
	propsToShow: string[];
}

export const DEFAULT_SETTINGS: CookbookSettings = {
	propsToShow: ["title", "cover"],
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
				"List of all properties you wish to display in the cookbook recipe grid. As comma seperated list."
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
					})
			);
	}
}
