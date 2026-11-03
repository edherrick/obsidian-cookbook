import { setIcon } from "obsidian";
import type { Setting, SettingDefinitionList } from "obsidian";
import type { IngredientGroup, KeywordGroup } from "../types";
import { uniqueName } from "./host";
import { keywordField } from "./keywordField";
import type { KeywordField } from "./keywordField";
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
	/** What the keywords are called: field label, then singular and plural for the count. */
	keywordsLabel?: string;
	countNoun?: [string, string];
	/** Dietary groups only: a second list of terms that must NOT match. */
	excludable?: boolean;
	/** Called once an item's name is changed and the name box is left. */
	onRename?: (from: string, to: string) => void;
}

/**
 * Rows the user has opened. Keyed by the item itself so the state survives
 * refresh(), reordering and renaming; restoring defaults makes new items,
 * which start closed.
 */
const expanded = new WeakSet<KeywordGroup>();

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
): () => void {
	const row = setting.settingEl;
	row.addClass("cookbook-list-row");
	setting.setDesc("");
	const control = setting.controlEl;

	const toggle = control.createEl("button", { cls: "clickable-icon cookbook-row-toggle" });

	setting.addText((t) => {
		t.inputEl.addClass("cookbook-cat-name");
		t.setPlaceholder(opts.namePlaceholder)
			.setValue(item.name)
			.onChange((value) => {
				item.name = value;
				host.saveSoon();
			});
		// Renames are reported once, when the box is left, not per keystroke:
		// a half-typed name could collide with another item's
		let nameBefore = item.name;
		t.inputEl.addEventListener("focus", () => {
			if (item.name.trim()) nameBefore = item.name;
		});
		t.inputEl.addEventListener("change", () => {
			// A cleared name is mid-edit: keep the old one to rename from
			if (!item.name.trim()) return;
			if (item.name !== nameBefore) opts.onRename?.(nameBefore, item.name);
			nameBefore = item.name;
		});
	});

	// Collapsed: a one-line preview. Clicking it opens the row.
	const summary = control.createDiv({ cls: "cookbook-row-summary" });
	const countEl = summary.createSpan({ cls: "cookbook-row-count" });
	const previewEl = summary.createSpan({ cls: "cookbook-row-preview" });
	const [one, many] = opts.countNoun ?? ["keyword", "keywords"];
	const updateSummary = () => {
		const n = item.keywords.length;
		countEl.setText(`${n} ${n === 1 ? one : many}`);
		previewEl.setText(item.keywords.join(", "));
	};
	updateSummary();

	// Expanded: every keyword, as pills
	const detail = control.createDiv({ cls: "cookbook-row-detail" });
	const keywords = keywordField(detail, {
		label: opts.keywordsLabel ?? "Keywords",
		placeholder: opts.keywordsPlaceholder ?? "Type or paste keywords, comma-separated",
		get: () => item.keywords,
		set: (value) => {
			item.keywords = value;
			updateSummary();
			host.saveSoon();
		},
	});

	let excludes: KeywordField | null = null;
	if (opts.excludable) {
		const group = item as IngredientGroup;
		excludes = keywordField(detail, {
			label: "Doesn't match",
			title: "Terms that look like a match but are not, such as coconut milk in the dairy group",
			placeholder: "Coconut milk",
			get: () => group.excludeKeywords ?? [],
			set: (value) => {
				group.excludeKeywords = value.length > 0 ? value : undefined;
				host.saveSoon();
			},
		});
	}

	// Toggled in place rather than via refresh(), which would rebuild the page
	const apply = () => {
		const open = expanded.has(item);
		row.toggleClass("is-expanded", open);
		setIcon(toggle, open ? "chevron-down" : "chevron-right");
		toggle.setAttr("aria-expanded", String(open));
		toggle.setAttr("aria-label", `${open ? "Hide" : "Show"} ${(opts.keywordsLabel ?? "keywords").toLowerCase()} for ${item.name}`);
	};
	const setOpen = (open: boolean) => {
		if (open) expanded.add(item);
		else expanded.delete(item);
		apply();
		if (open) keywords.fit();
	};
	toggle.addEventListener("click", () => setOpen(!expanded.has(item)));
	summary.addEventListener("click", () => {
		setOpen(true);
		keywords.focus();
	});
	apply();

	return () => {
		keywords.destroy();
		excludes?.destroy();
	};
}
