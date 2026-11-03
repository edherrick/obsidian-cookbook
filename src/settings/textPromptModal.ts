import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export interface TextPromptOptions {
	title: string;
	placeholder: string;
	submitLabel: string;
	/** Return an error to show, or null to accept and close. */
	validate?: (value: string) => string | null;
	onSubmit: (value: string) => void;
}

/** Ask for one line of text, such as a new category's name. */
export class TextPromptModal extends Modal {
	constructor(
		app: App,
		private readonly opts: TextPromptOptions,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.opts.title);
		let value = "";
		const error = this.contentEl.createDiv({ cls: "cookbook-prompt-error" });

		const submit = () => {
			const trimmed = value.trim();
			if (!trimmed) return;
			const problem = this.opts.validate?.(trimmed) ?? null;
			if (problem) {
				error.setText(problem);
				return;
			}
			this.close();
			this.opts.onSubmit(trimmed);
		};

		new Setting(this.contentEl).addText((t) => {
			t.setPlaceholder(this.opts.placeholder).onChange((v) => {
				value = v;
				error.setText("");
			});
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					submit();
				}
			});
			window.setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(this.contentEl).addButton((b) => b.setButtonText(this.opts.submitLabel).setCta().onClick(submit));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
