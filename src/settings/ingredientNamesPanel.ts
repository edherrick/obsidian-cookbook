import { Notice, setIcon } from "obsidian";
import type CookbookPlugin from "../main";
import { likelyDuplicates, mergeIngredientName } from "../vocab/names";
import type { IngredientName } from "../vocab/names";
import { UNCATEGORIZED } from "../ingredients/categorize";

let datalistSeq = 0;

/** Scan results kept by the settings tab, so a re-render after a merge doesn't lose them. */
export interface IngredientNamesState {
	names: IngredientName[] | null;
}

/**
 * Every ingredient name in the library with how many recipes use it. Likely
 * duplicates are suggested; any name can be merged into another, which makes
 * it another name of that ingredient. Names not in the ingredient list can be
 * added to it. Scanning reads every recipe, so it waits for a click.
 */
export function renderIngredientNamesPanel(
	container: HTMLElement,
	plugin: CookbookPlugin,
	state: IngredientNamesState,
	onMerged: () => void,
): void {
	container.empty();
	container.addClass("cookbook-names-panel");

	if (state.names) {
		renderNames(container, plugin, state.names, onMerged);
		return;
	}

	const scanBtn = container.createEl("button", { text: "Scan ingredient names" });
	scanBtn.addEventListener("click", () => {
		scanBtn.disabled = true;
		scanBtn.setText("Scanning…");
		void plugin.ingredientNames().then((names) => {
			state.names = names;
			renderNames(container, plugin, names, onMerged);
		});
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

	const isListed = (name: string) => plugin.vocabulary.catalog.exact(name) !== undefined;
	type Show = "duplicates" | "unlisted" | "all";
	let show: Show = dupes.size > 0 ? "duplicates" : "unlisted";

	const header = container.createDiv({ cls: "cookbook-names-header" });
	const summary = header.createSpan();
	const showSelect = header.createEl("select", { cls: "dropdown" });
	for (const [value, text] of [
		["duplicates", "Likely duplicates"],
		["unlisted", "Not in ingredient list"],
		["all", "All names"],
	] as const) {
		showSelect.createEl("option", { value, text });
	}
	const list = container.createDiv({ cls: "cookbook-names-list" });

	const merge = async (source: string, target: string) => {
		mergeIngredientName(plugin.settings.ingredients, source, target);
		await plugin.saveSettings();
		new Notice(`“${source}” now counts as “${target.trim()}”.`);
		onMerged();
	};

	/** Add a recipe's name to the list, starting from what partial matches suggest. */
	const add = async (name: string) => {
		const vocab = plugin.vocabulary;
		const category = vocab.categoryFor(name);
		plugin.settings.ingredients.push({
			name,
			otherNames: [],
			category: category === UNCATEGORIZED ? "" : category,
			groups: [...vocab.catalog.groupsFor(name)],
			...(vocab.isStaple(name) ? { staple: true } : {}),
		});
		await plugin.saveSettings();
		new Notice(`Added “${name}” to ingredients${category === UNCATEGORIZED ? "" : ` in ${category}`}.`);
		onMerged();
	};

	const draw = () => {
		list.empty();
		showSelect.value = show;
		const unlisted = names.filter((n) => !isListed(n.name)).length;
		summary.setText(`${names.length} names: ${dupes.size} with likely duplicates, ${unlisted} not in your list.`);
		for (const n of names) {
			const suggestions = dupes.get(n.key) ?? [];
			const listed = isListed(n.name);
			if (show === "duplicates" && suggestions.length === 0) continue;
			if (show === "unlisted" && listed) continue;

			const row = list.createDiv({ cls: "cookbook-names-row" });
			const label = row.createDiv({ cls: "cookbook-names-label" });
			label.createSpan({ cls: "cookbook-names-name", text: n.name });
			label.createSpan({
				cls: "cookbook-names-count",
				text: `${n.recipes.length} recipe${n.recipes.length === 1 ? "" : "s"}`,
				attr: { title: n.recipes.join("\n") },
			});

			const actions = row.createDiv({ cls: "cookbook-names-actions" });
			if (!listed) {
				const addBtn = actions.createEl("button", { text: "Add", cls: "mod-cta" });
				addBtn.title = "Add to the ingredient list";
				addBtn.addEventListener("click", () => void add(n.name));
			}
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

	showSelect.addEventListener("change", () => {
		show = showSelect.value as Show;
		draw();
	});
	draw();
}
