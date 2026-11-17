import { Notice } from "obsidian";
import type CookbookPlugin from "../main";
import type { PrepPhrase } from "../vocab/prepWords";
import { TextPromptModal } from "./textPromptModal";

/** Scan results kept by the settings tab, so a re-render after an add doesn't lose them. */
export interface PrepWordsState {
	phrases: PrepPhrase[] | null;
}

/**
 * Prep-note phrases that no technique knows ("smashed", "trimmed"), with how
 * many recipes use each. Any phrase can be added to a technique's words,
 * start a new technique, or be ignored ("finely", "gluten-free if needed"). Also opens the recipe tag check. Scanning reads
 * every recipe, so it waits for a click.
 */
export function renderPrepWordsPanel(
	container: HTMLElement,
	plugin: CookbookPlugin,
	state: PrepWordsState,
	onChanged: () => void,
): void {
	container.empty();
	container.addClass("cookbook-names-panel");

	const buttons = container.createDiv({ cls: "cookbook-names-actions" });
	const checkBtn = buttons.createEl("button", { text: "Check recipe tags" });
	checkBtn.title = "Find untagged prep words, unknown tags and notes that repeat their tag";
	checkBtn.addEventListener("click", () => plugin.openTechniqueCheck());

	const body = container.createDiv();
	if (state.phrases) {
		renderPhrases(body, plugin, state.phrases, onChanged);
		return;
	}
	const scanBtn = buttons.createEl("button", { text: "Scan prep words", cls: "mod-cta" });
	scanBtn.addEventListener("click", () => {
		scanBtn.disabled = true;
		scanBtn.setText("Scanning…");
		void plugin.prepPhrases().then((phrases) => {
			state.phrases = phrases;
			scanBtn.remove();
			renderPhrases(body, plugin, phrases, onChanged);
		});
	});
}

function renderPhrases(
	container: HTMLElement,
	plugin: CookbookPlugin,
	phrases: PrepPhrase[],
	onChanged: () => void,
): void {
	container.empty();
	const header = container.createDiv({ cls: "cookbook-names-header" });
	const summary = header.createSpan();
	const list = container.createDiv({ cls: "cookbook-names-list" });

	/** Still unknown with the current techniques, and not ignored; an add can cover several phrases. */
	const open = () => {
		const ignored = new Set(plugin.settings.ignoredPrepPhrases.map((x) => x.toLowerCase()));
		return phrases.filter((p) => !ignored.has(p.phrase) && plugin.vocabulary.matchWords(p.phrase).length === 0);
	};

	const ignore = async (phrase: string) => {
		plugin.settings.ignoredPrepPhrases = [...plugin.settings.ignoredPrepPhrases, phrase];
		await plugin.saveSettings();
		draw();
	};

	const unignoreAll = async () => {
		plugin.settings.ignoredPrepPhrases = [];
		await plugin.saveSettings();
		draw();
	};

	const addTo = async (phrase: string, technique: string) => {
		const t = plugin.settings.techniques.find((x) => x.name === technique);
		if (!t) return;
		if (!t.keywords.some((k) => k.toLowerCase() === phrase)) t.keywords.push(phrase);
		await plugin.saveSettings();
		new Notice(`“${phrase}” now counts as ${technique}.`);
		changed();
	};

	const newTechnique = (phrase: string) => {
		new TextPromptModal(plugin.app, {
			title: `New technique for “${phrase}”`,
			placeholder: "Name, used as its tag (e.g. crush)",
			submitLabel: "Add technique",
			validate: (name) => {
				if (!/^[\w-]+$/.test(name)) return "One word: letters, numbers, - or _ (it becomes a tag).";
				const taken = plugin.settings.techniques.some((t) => t.name.toLowerCase() === name.toLowerCase());
				return taken ? "A technique already has that name." : null;
			},
			onSubmit: (name) => {
				plugin.settings.techniques.push({ name: name.toLowerCase(), keywords: [phrase] });
				void plugin.saveSettings().then(() => {
					new Notice(`Added the ${name.toLowerCase()} technique.`);
					changed();
				});
			},
		}).open();
	};

	/** The technique list above is rebuilt by the refresh; this panel redraws itself. */
	const changed = () => {
		onChanged();
		draw();
	};

	const draw = () => {
		list.empty();
		const rows = open();
		header.querySelector(".cookbook-names-unignore")?.remove();
		summary.setText(
			rows.length === 0
				? "Every prep word in your recipes belongs to a technique or is ignored."
				: `${rows.length} prep word${rows.length === 1 ? "" : "s"} no technique knows. Add one to a technique to count it as that technique, or ignore it if it isn't prep.`,
		);
		const ignoredCount = plugin.settings.ignoredPrepPhrases.length;
		if (ignoredCount > 0) {
			const btn = header.createEl("button", { cls: "cookbook-names-unignore", text: `Stop ignoring ${ignoredCount}` });
			btn.addEventListener("click", () => void unignoreAll());
		}
		const names = plugin.settings.techniques.map((t) => t.name);
		for (const p of rows) {
			const row = list.createDiv({ cls: "cookbook-names-row" });
			const label = row.createDiv({ cls: "cookbook-names-label" });
			label.createSpan({ cls: "cookbook-names-name", text: p.phrase });
			label.createSpan({
				cls: "cookbook-names-count",
				text: `${p.recipes.length} recipe${p.recipes.length === 1 ? "" : "s"}`,
				attr: { title: p.recipes.join("\n") },
			});

			const actions = row.createDiv({ cls: "cookbook-names-actions" });
			const select = actions.createEl("select", { cls: "dropdown", attr: { "aria-label": `Technique for ${p.phrase}` } });
			for (const n of names) select.createEl("option", { value: n, text: n });
			const addBtn = actions.createEl("button", { text: "Add to technique" });
			addBtn.addEventListener("click", () => void addTo(p.phrase, select.value));
			const newBtn = actions.createEl("button", { text: "New technique" });
			newBtn.addEventListener("click", () => newTechnique(p.phrase));
			const ignoreBtn = actions.createEl("button", { text: "Ignore" });
			ignoreBtn.title = "Not a prep technique: stop listing it";
			ignoreBtn.addEventListener("click", () => void ignore(p.phrase));
		}
	};
	draw();
}
