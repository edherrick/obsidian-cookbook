import { Modal, Notice, TFile } from "obsidian";
import type { App } from "obsidian";
import type { Recipe } from "../recipes/repository";
import type { Vocabulary } from "./vocabulary";
import { checkRecipeContent, withTechniqueTags } from "./check";
import type { VocabularyIssue } from "./check";

interface CheckSources {
	recipes: () => Recipe[];
	vocab: () => Vocabulary;
}

/**
 * Lists technique-tag problems across all recipes: unknown tags, and prep
 * words that name a technique without tagging it. Untagged lines can be fixed
 * in place; everything else opens the recipe at the line.
 */
export class VocabularyCheckModal extends Modal {
	constructor(
		app: App,
		private readonly sources: CheckSources,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Recipe technique tags");
		void this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("cookbook-vocab-check");
		const vocab = this.sources.vocab();

		const results: { file: TFile; recipe: Recipe; issues: VocabularyIssue[] }[] = [];
		for (const recipe of this.sources.recipes()) {
			const file = this.app.vault.getFileByPath(recipe.path);
			if (!file) continue;
			const issues = checkRecipeContent(await this.app.vault.cachedRead(file), vocab);
			if (issues.length > 0) results.push({ file, recipe, issues });
		}

		if (results.length === 0) {
			contentEl.createEl("p", { text: "Every technique is tagged with a known tag." });
			return;
		}

		const total = results.reduce((n, r) => n + r.issues.length, 0);
		contentEl.createEl("p", {
			cls: "cookbook-vocab-summary",
			text: `${total} line${total === 1 ? "" : "s"} in ${results.length} recipe${results.length === 1 ? "" : "s"}.`,
		});

		for (const { file, recipe, issues } of results) {
			contentEl.createEl("h4", { text: recipe.title });
			for (const issue of issues) this.renderIssue(contentEl, file, issue, vocab);
		}
	}

	private renderIssue(
		parent: HTMLElement,
		file: TFile,
		issue: VocabularyIssue,
		vocab: Vocabulary,
	): void {
		const row = parent.createDiv({ cls: "cookbook-vocab-row" });
		const body = row.createDiv({ cls: "cookbook-vocab-body" });
		body.createEl("code", { text: issue.text.trim() });
		const tags = issue.techniques.map((t) => vocab.tagFor(t)).join(" ");
		body.createDiv({
			cls: "cookbook-vocab-message",
			text:
				issue.kind === "unknown-tag"
					? `Unknown technique: ${tags}`
					: `Untagged. Suggested: ${tags}`,
		});

		const actions = row.createDiv({ cls: "cookbook-vocab-actions" });
		actions.createEl("button", { text: "Open" }).addEventListener("click", () => {
			void this.app.workspace
				.getLeaf(false)
				.openFile(file, { eState: { line: issue.line } })
				.then(() => this.close());
		});

		if (issue.kind === "untagged") {
			const fix = actions.createEl("button", { text: "Add tags", cls: "mod-cta" });
			fix.addEventListener("click", () => {
				fix.disabled = true;
				void this.applyFix(file, issue, vocab).then((ok) => {
					if (ok) row.addClass("is-fixed");
					else fix.disabled = false;
				});
			});
		}
	}

	/** Rewrite one line, but only if it still reads as it did when checked. */
	private async applyFix(file: TFile, issue: VocabularyIssue, vocab: Vocabulary): Promise<boolean> {
		let applied = false;
		await this.app.vault.process(file, (content) => {
			const lines = content.split("\n");
			if (lines[issue.line] !== issue.text) return content;
			lines[issue.line] = withTechniqueTags(issue.text, issue.techniques, vocab);
			applied = true;
			return lines.join("\n");
		});
		if (!applied) new Notice("That line changed since the check ran. Run the check again.");
		return applied;
	}
}
