import { Notice } from "obsidian";
import type { Setting, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import type { Aisle, StoreLayout } from "../types";
import { keywordField } from "./keywordField";
import { resolveRoute } from "../shopping/route";
import { uniqueName } from "./host";
import type { SettingsHost } from "./host";

/** The active-store picker and the list of stores, each opening its route. */
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
			heading: "Stores",
			items: settings.storeLayouts.map((layout) => storePage(host, layout)),
			onDelete: (index) => {
				const layout = settings.storeLayouts[index];
				if (layout) deleteStore(host, layout);
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

/** One store: its name, and its aisles in the order they're walked. */
function storePage(host: SettingsHost, layout: StoreLayout): SettingDefinitionPage {
	const { settings } = host.plugin;
	const route = () => resolveRoute(layout.aisleOrder, settings.shoppingCategories);
	const placed = () => new Set((layout.aisles ?? []).flatMap((a) => a.categories));
	/** Categories this store hasn't put in a numbered aisle, in its walking order. */
	const unplaced = () => route().filter((c) => !placed().has(c));
	const sortedAisles = () => [...(layout.aisles ?? [])].sort((a, b) => a.number - b.number);
	const isActive = () => (settings.activeStoreLayout ?? settings.storeLayouts[0]?.name) === layout.name;

	/** Save a new route; if this store is the active one, re-sort the open list too. */
	const saveRoute = (aisleOrder: string[]) => {
		layout.aisleOrder = aisleOrder;
		host.saveNow();
		if (isActive()) void host.plugin.applyActiveRoute();
		host.refresh();
	};

	return {
		type: "page",
		name: layout.name || "Unnamed store",
		displayValue: () => {
			const n = layout.aisles?.length ?? 0;
			const aisles = n > 0 ? `${n} numbered ${n === 1 ? "aisle" : "aisles"}` : "No numbered aisles";
			return isActive() ? `Active · ${aisles}` : aisles;
		},
		items: [
			{
				type: "group",
				items: [
					{
						name: "Store name",
						render: (setting: Setting) => renderName(setting, layout, host),
					},
					{
						name: "Duplicate store",
						desc: "Start a new store from this route. A new shop is usually a small change to one you know.",
						action: () => {
							const index = settings.storeLayouts.indexOf(layout);
							settings.storeLayouts.splice(index + 1, 0, {
								name: uniqueName(
									`${layout.name} copy`,
									settings.storeLayouts.map((l) => l.name),
								),
								aisleOrder: route(),
							});
							host.saveNow();
							host.refresh();
							new Notice(`Added ${settings.storeLayouts[index + 1]?.name ?? "a copy"}.`);
						},
					},
					{
						name: "Delete store",
						desc: "Remove this store and its aisle order. The last store can't be deleted.",
						render: (setting: Setting) => renderDelete(setting, layout, host),
					},
				],
			},
			{
				type: "list",
				heading: "Numbered aisles",
				emptyState: "No numbered aisles. Add one to shelve categories, or single ingredients, under an aisle number.",
				items: sortedAisles().map((aisle) => ({
					name: `Aisle ${aisle.number}`,
					desc: [...aisle.categories, ...aisle.ingredients].join(", "),
					render: (setting: Setting) => renderAisle(setting, aisle, host),
				})),
				onDelete: (index) => {
					const aisle = sortedAisles()[index];
					layout.aisles = (layout.aisles ?? []).filter((a) => a !== aisle);
					host.saveNow();
					host.refresh();
				},
				addItem: {
					name: "Add aisle",
					action: () => {
						const next = Math.max(0, ...(layout.aisles ?? []).map((a) => a.number)) + 1;
						layout.aisles = [...(layout.aisles ?? []), { number: next, categories: [], ingredients: [] }];
						host.saveNow();
						host.refresh();
					},
				},
			},
			{
				type: "list",
				heading: "Categories not in an aisle",
				emptyState: "Every category is in a numbered aisle.",
				extraButtons: [
					(b) =>
						b
							.setIcon("rotate-ccw")
							.setTooltip("Reset to category order")
							.onClick(() => saveRoute(settings.shoppingCategories.map((c) => c.name))),
				],
				items: unplaced().map((name) => ({ name })),
				onReorder: (from, to) => {
					// Only these are shown; keep the placed ones after them
					const order = unplaced();
					const [moved] = order.splice(from, 1);
					if (moved === undefined) return;
					order.splice(to, 0, moved);
					saveRoute([...order, ...route().filter((c) => placed().has(c))]);
				},
			},
		],
	};
}

function renderName(setting: Setting, layout: StoreLayout, host: SettingsHost): void {
	const { settings } = host.plugin;
	setting.addText((t) => {
		t.setPlaceholder("Shop name")
			.setValue(layout.name)
			.onChange((value) => {
				if (settings.activeStoreLayout === layout.name) settings.activeStoreLayout = value;
				layout.name = value;
				host.saveSoon();
			});
		// The page is named after the store, so a rename removes the page being
		// shown: step back to the store list, rebuild, and reopen it by its new name
		t.inputEl.addEventListener("change", () => {
			const doc = setting.settingEl.doc;
			leavePage(setting.settingEl);
			host.refresh();
			const name = layout.name || "Unnamed store";
			window.setTimeout(() => {
				const entry = Array.from(doc.querySelectorAll<HTMLElement>(".setting-item")).find(
					(el) => el.querySelector(".setting-item-name")?.textContent === name,
				);
				entry?.click();
			}, 0);
		});
	});
}

/**
 * Go back from the settings page holding `el`. There is no navigation API,
 * but every settings page has a back button.
 */
function leavePage(el: HTMLElement): void {
	el.closest(".setting-page")?.querySelector<HTMLElement>(".setting-page-back-button")?.click();
}

/** Two clicks to delete, so one stray click can't lose a route. */
function renderDelete(setting: Setting, layout: StoreLayout, host: SettingsHost): () => void {
	let timer: number | null = null;
	setting.addButton((b) => {
		b.setButtonText("Delete")
			.setDestructive()
			.setDisabled(host.plugin.settings.storeLayouts.length <= 1)
			.onClick(() => {
				if (timer === null) {
					b.setButtonText("Click again to delete");
					timer = window.setTimeout(() => {
						timer = null;
						b.setButtonText("Delete");
					}, 3000);
					return;
				}
				window.clearTimeout(timer);
				timer = null;
				// This page is the deleted store's, so leave it first
				leavePage(setting.settingEl);
				deleteStore(host, layout);
			});
	});
	return () => {
		if (timer !== null) window.clearTimeout(timer);
	};
}

function deleteStore(host: SettingsHost, layout: StoreLayout): void {
	const { settings } = host.plugin;
	if (settings.storeLayouts.length <= 1) {
		new Notice("Keep at least one store layout.");
		return;
	}
	const wasActive = (settings.activeStoreLayout ?? settings.storeLayouts[0]?.name) === layout.name;
	settings.storeLayouts = settings.storeLayouts.filter((l) => l !== layout);
	if (wasActive) {
		settings.activeStoreLayout = settings.storeLayouts[0]?.name;
		void host.plugin.applyActiveRoute();
	}
	host.saveNow();
	host.refresh();
}

/** One aisle: its number, the categories shelved there, and single ingredients this shop keeps there. */
function renderAisle(setting: Setting, aisle: Aisle, host: SettingsHost): () => void {
	const { settings } = host.plugin;
	setting.settingEl.addClass("cookbook-aisle-row");
	setting.setName("");
	setting.setDesc("");

	const head = setting.controlEl.createDiv({ cls: "cookbook-aisle-head" });
	head.createSpan({ cls: "cookbook-aisle-label", text: "Aisle" });
	const number = head.createEl("input", {
		cls: "cookbook-aisle-number",
		type: "number",
		attr: { min: "0", step: "1", "aria-label": "Aisle number" },
	});
	number.value = String(aisle.number);
	// Aisles are listed by number, so re-sort once editing ends
	number.addEventListener("change", () => {
		const n = Number.parseInt(number.value, 10);
		if (Number.isFinite(n) && n >= 0) aisle.number = n;
		number.value = String(aisle.number);
		host.saveNow();
		host.refresh();
	});

	const fields = [
		keywordField(setting.controlEl, {
			label: "Categories",
			placeholder: "Choose a category",
			get: () => aisle.categories,
			set: (value) => {
				aisle.categories = value;
				host.saveSoon();
			},
			choices: {
				app: host.app,
				items: () => settings.shoppingCategories.map((c) => c.name),
				noun: "category",
			},
		}),
		keywordField(setting.controlEl, {
			label: "Also here",
			title: "Single ingredients this shop keeps in this aisle, whatever their category",
			placeholder: "Choose an ingredient",
			get: () => aisle.ingredients,
			set: (value) => {
				aisle.ingredients = value;
				host.saveSoon();
			},
			choices: {
				app: host.app,
				items: () => settings.ingredients.map((i) => i.name),
				noun: "ingredient",
			},
		}),
	];
	return () => fields.forEach((f) => f.destroy());
}
