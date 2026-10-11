import { Notice, setIcon } from "obsidian";
import type CookbookPlugin from "../main";
import { likelyDuplicates, mergeAlias } from "../vocab/names";
import type { IngredientName } from "../vocab/names";

let datalistSeq = 0;

/**
 * Every ingredient name in the library with how many recipes use it. Likely
 * duplicates are suggested; any name can be merged into another, which adds
 * it to the aliases table. Scanning reads every recipe, so it waits for a click.
 */
export function renderIngredientNamesPanel(
	container: HTMLElement,
	plugin: CookbookPlugin,
	onMerged: () => void,
): void {
	container.empty();
	container.addClass("cookbook-names-panel");

	const scanBtn = container.createEl("button", { text: "Scan ingredient names" });
	scanBtn.addEventListener("click", () => {
		scanBtn.disabled = true;
		scanBtn.setText("Scanning…");
		void plugin.ingredientNames().then((names) => renderNames(container, plugin, names, onMerged));
	});
}

function renderNames(
	container: HTMLElement,
	plugin: CookbookPlugin,
	names: IngredientName[],
	onMerged: () => void,
): void {
	container.empty();
	const dupes = likelyDuplicates(names);
	const listId = `cookbook-ingredient-names-${++datalistSeq}`;
	const datalist = container.createEl("datalist", { attr: { id: listId } });
	for (const n of names) datalist.createEl("option", { attr: { value: n.name } });

	let onlyDupes = dupes.size > 0;
	const header = container.createDiv({ cls: "cookbook-names-header" });
	header.createSpan({
		text: `${names.length} ingredients, ${dupes.size} with likely duplicates.`,
	});
	const filterBtn = header.createEl("button");
	const list = container.createDiv({ cls: "cookbook-names-list" });

	const merge = async (source: string, target: string) => {
		mergeAlias(plugin.settings.ingredientAliases, source, target);
		await plugin.saveSettings();
		new Notice(`“${source}” now counts as “${target.trim()}”.`);
		onMerged();
	};

	const draw = () => {
		list.empty();
		filterBtn.setText(onlyDupes ? "Show all" : "Show likely duplicates only");
		for (const n of names) {
			const suggestions = dupes.get(n.key) ?? [];
			if (onlyDupes && suggestions.length === 0) continue;

			const row = list.createDiv({ cls: "cookbook-names-row" });
			const label = row.createDiv({ cls: "cookbook-names-label" });
			label.createSpan({ cls: "cookbook-names-name", text: n.name });
			label.createSpan({
				cls: "cookbook-names-count",
				text: `${n.recipes.length} recipe${n.recipes.length === 1 ? "" : "s"}`,
				attr: { title: n.recipes.join("\n") },
			});

			const actions = row.createDiv({ cls: "cookbook-names-actions" });
			for (const s of suggestions) {
				const btn = actions.createEl("button", { text: `Merge into ${s}` });
				btn.addEventListener("click", () => void merge(n.name, s));
			}
			const input = actions.createEl("input", {
				type: "text",
				attr: { list: listId, placeholder: "Merge into…" },
			});
			const go = actions.createEl("button");
			go.title = "Merge";
			setIcon(go, "merge");
			go.addEventListener("click", () => {
				if (input.value.trim()) void merge(n.name, input.value);
			});
		}
	};

	filterBtn.addEventListener("click", () => {
		onlyDupes = !onlyDupes;
		draw();
	});
	draw();
}
