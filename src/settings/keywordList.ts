import type { Setting, SettingDefinitionList } from "obsidian";
import type { IngredientGroup, KeywordGroup } from "../types";
import { commaList, uniqueName } from "./host";
import type { SettingsHost } from "./host";

export interface KeywordListOptions {
	/** Read fresh on every use: restoring defaults replaces the array. */
	getItems: () => KeywordGroup[];
	restoreDefaults: () => void;
	/** Name given to a new row, such as "New group". */
	newItemName: string;
	addLabel: string;
	emptyState: string;
	namePlaceholder: string;
	keywordsPlaceholder?: string;
	reorderable?: boolean;
	/** Dietary groups only: a second list of terms that must NOT match. */
	excludable?: boolean;
}

/** An editable list of named keyword groups: categories, groups, techniques, aliases. */
export function keywordList(host: SettingsHost, opts: KeywordListOptions): SettingDefinitionList {
	const structural = () => {
		host.saveNow();
		host.refresh();
	};

	return {
		type: "list",
		emptyState: opts.emptyState,
		extraButtons: [
			(b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip("Restore defaults")
					.onClick(() => {
						opts.restoreDefaults();
						structural();
					}),
		],
		items: opts.getItems().map((item) => ({
			// Shown nowhere (the row edits the name inline) but used by settings search
			name: item.name,
			desc: item.keywords.join(", "),
			render: (setting: Setting) => renderRow(setting, item, host, opts),
		})),
		onDelete: (index) => {
			opts.getItems().splice(index, 1);
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
				const name = uniqueName(
					opts.newItemName,
					items.map((i) => i.name),
				);
				items.push({ name, keywords: [] });
				structural();
			},
		},
	};
}

function renderRow(
	setting: Setting,
	item: KeywordGroup,
	host: SettingsHost,
	opts: KeywordListOptions,
): void {
	setting.settingEl.addClass("cookbook-list-row");
	setting.setDesc("");

	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-name");
		t.setPlaceholder(opts.namePlaceholder)
			.setValue(item.name)
			.onChange((value) => {
				item.name = value;
				host.saveSoon();
			});
	});

	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-keywords");
		t.setPlaceholder(opts.keywordsPlaceholder ?? "Keywords, comma-separated")
			.setValue(item.keywords.join(", "))
			.onChange((value) => {
				item.keywords = commaList(value);
				host.saveSoon();
			});
	});

	if (opts.excludable) {
		const group = item as IngredientGroup;
		setting.addText((t) => {
			t.inputEl.addClass("cookbook-cat-excludes");
			t.inputEl.title =
				"Terms that look like a match but are not, such as coconut milk in the dairy group";
			t.setPlaceholder("Not: coconut milk")
				.setValue(group.excludeKeywords?.join(", ") ?? "")
				.onChange((value) => {
					const parsed = commaList(value);
					group.excludeKeywords = parsed.length > 0 ? parsed : undefined;
					host.saveSoon();
				});
		});
	}
}
