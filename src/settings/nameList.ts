import type { Setting, SettingDefinitionList } from "obsidian";
import { uniqueName } from "./host";
import type { SettingsHost } from "./host";

export interface NameListOptions {
	/** Read fresh on every use: restoring defaults replaces the array. */
	getItems: () => { name: string }[];
	newItemName: string;
	addLabel: string;
	emptyState: string;
	namePlaceholder: string;
	reorderable?: boolean;
	/** Shown beside each name, such as "34 ingredients". */
	usage: (name: string) => string;
	/** Called once a name is changed and the box is left. */
	onRename: (from: string, to: string) => void;
	/** Called after an item is removed, to clear references to it. */
	onDelete: (name: string) => void;
}

/**
 * An editable list of names, for categories and dietary groups: what belongs
 * to each is set on the ingredients, so only the name and order live here.
 */
export function nameList(host: SettingsHost, opts: NameListOptions): SettingDefinitionList {
	const structural = () => {
		host.saveNow();
		host.refresh();
	};

	return {
		type: "list",
		emptyState: opts.emptyState,
		items: opts.getItems().map((item) => ({
			name: item.name,
			render: (setting: Setting) => renderRow(setting, item, host, opts),
		})),
		onDelete: (index) => {
			const [removed] = opts.getItems().splice(index, 1);
			if (removed) opts.onDelete(removed.name);
			structural();
		},
		onReorder: opts.reorderable
			? (from, to) => {
					const items = opts.getItems();
					const [moved] = items.splice(from, 1);
					if (moved) items.splice(to, 0, moved);
					structural();
				}
			: undefined,
		addItem: {
			name: opts.addLabel,
			action: () => {
				const items = opts.getItems();
				items.push({ name: uniqueName(opts.newItemName, items.map((i) => i.name)) });
				structural();
			},
		},
	};
}

function renderRow(setting: Setting, item: { name: string }, host: SettingsHost, opts: NameListOptions): void {
	setting.settingEl.addClass("cookbook-list-row");
	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-name");
		t.setPlaceholder(opts.namePlaceholder)
			.setValue(item.name)
			.onChange((value) => {
				item.name = value;
				host.saveSoon();
			});
		// Renames are applied once, when the box is left, not per keystroke:
		// a half-typed name could collide with another item's
		let nameBefore = item.name;
		t.inputEl.addEventListener("focus", () => {
			if (item.name.trim()) nameBefore = item.name;
		});
		t.inputEl.addEventListener("change", () => {
			// A cleared name is mid-edit: keep the old one to rename from
			if (!item.name.trim()) return;
			if (item.name !== nameBefore) {
				opts.onRename(nameBefore, item.name);
				host.saveSoon();
				// Counts beside other names may have changed
				host.refresh();
			}
			nameBefore = item.name;
		});
	});
	setting.controlEl.createSpan({ cls: "cookbook-row-usage", text: opts.usage(item.name) });
}
