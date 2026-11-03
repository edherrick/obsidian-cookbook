import { Notice } from "obsidian";
import type { Setting, SettingDefinitionItem } from "obsidian";
import type { StoreLayout } from "../types";
import { uniqueName } from "./host";
import type { SettingsHost } from "./host";

/** The active-store picker and the editable list of shop routes. */
export function storeLayoutItems(host: SettingsHost): SettingDefinitionItem[] {
	const { settings } = host.plugin;
	const structural = () => {
		host.saveNow();
		host.refresh();
	};

	return [
		{
			type: "group",
			items: [
				{
					name: "Active store",
					desc: "The shop whose aisle order sorts the shopping list.",
					control: {
						type: "dropdown",
						key: "activeStoreLayout",
						options: Object.fromEntries(settings.storeLayouts.map((l) => [l.name, l.name])),
					},
				},
			],
		},
		{
			type: "list",
			heading: "Routes",
			items: settings.storeLayouts.map((layout) => ({
				name: layout.name,
				render: (setting: Setting) => renderRow(setting, layout, host),
			})),
			onDelete: (index) => {
				if (settings.storeLayouts.length <= 1) {
					new Notice("Keep at least one store layout.");
					return;
				}
				const [removed] = settings.storeLayouts.splice(index, 1);
				if (settings.activeStoreLayout === removed?.name) {
					settings.activeStoreLayout = settings.storeLayouts[0]?.name;
				}
				structural();
			},
			addItem: {
				name: "Add store",
				action: () => {
					settings.storeLayouts.push({
						name: uniqueName(
							"New store",
							settings.storeLayouts.map((l) => l.name),
						),
						aisleOrder: settings.shoppingCategories.map((c) => c.name),
					});
					structural();
				},
			},
		},
	];
}

function renderRow(setting: Setting, layout: StoreLayout, host: SettingsHost): void {
	const { settings } = host.plugin;
	setting.settingEl.addClass("cookbook-list-row");

	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-name");
		t.setPlaceholder("Shop name")
			.setValue(layout.name)
			.onChange((value) => {
				if (settings.activeStoreLayout === layout.name) settings.activeStoreLayout = value;
				layout.name = value;
				host.saveSoon();
			});
		// The active-store dropdown lists names, so rebuild it once editing ends
		t.inputEl.addEventListener("change", () => host.refresh());
	});

	setting.controlEl.createSpan({
		cls: "cookbook-store-summary",
		text: `${layout.aisleOrder.length} aisles`,
	});

	setting.addExtraButton((b) =>
		b
			.setIcon("copy")
			.setTooltip("Duplicate")
			.onClick(() => {
				// A new shop is nearly always a tweak of a route you already walk
				const index = settings.storeLayouts.indexOf(layout);
				settings.storeLayouts.splice(index + 1, 0, {
					name: uniqueName(
						`${layout.name} copy`,
						settings.storeLayouts.map((l) => l.name),
					),
					aisleOrder: [...layout.aisleOrder],
				});
				host.saveNow();
				host.refresh();
			}),
	);
}
