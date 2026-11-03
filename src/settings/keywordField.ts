import { AbstractInputSuggest, setIcon } from "obsidian";
import type { App } from "obsidian";
import { matchChoices, mergeKeywords, splitList } from "./host";

export interface KeywordFieldOptions {
	/** Shown above the pills. Leave out when the setting's own name labels it. */
	label?: string;
	title?: string;
	placeholder: string;
	/** Read fresh each time: the list is replaced, never mutated. */
	get: () => string[];
	set: (keywords: string[]) => void;
	/**
	 * Restrict the field to these values, offered as suggestions while typing.
	 * Anything else stays in the box instead of becoming a pill.
	 */
	choices?: { app: App; items: () => string[]; noun: string };
}

export interface KeywordField {
	focus(): void;
	/** Re-measure after the field is shown; hidden fields can't be measured. */
	fit(): void;
	/** Close any open suggestion list. Call when the row is torn down. */
	destroy(): void;
}

let fieldCounter = 0;

/**
 * Keywords as removable pills, styled with Obsidian's own pill classes so it
 * matches list properties and follows the theme. Typing a comma or pressing
 * Enter adds what's typed; pasting a comma-separated list adds every item.
 * "Edit as text" swaps to a plain text box for bulk edits.
 */
export function keywordField(parent: HTMLElement, opts: KeywordFieldOptions): KeywordField {
	const field = parent.createDiv({ cls: "cookbook-row-field" });
	if (opts.title) field.title = opts.title;
	const choices = opts.choices;

	const header = field.createDiv({ cls: "cookbook-row-field-header" });
	const labelId = `cookbook-keyword-field-${++fieldCounter}`;
	header.createSpan({ cls: "cookbook-row-field-label", text: opts.label ?? "", attr: { id: labelId } });
	// A fixed set of choices has nothing to bulk-edit
	const modeBtn = choices ? null : header.createEl("button", { cls: "cookbook-field-mode" });
	if (!opts.label && !modeBtn) header.hide();

	// ─── Pills ───────────────────────────────────────────────────────────────
	const pills = field.createDiv({ cls: "multi-select-container" });
	// Obsidian's own pill input is a contenteditable div; its CSS expects one
	const input = pills.createDiv({
		cls: "multi-select-input",
		attr: {
			contenteditable: "true",
			role: "textbox",
			tabindex: "0",
			spellcheck: "false",
			"aria-labelledby": labelId,
		},
	});
	const typed = () => input.textContent ?? "";
	const setTyped = (text: string) => {
		input.textContent = text;
		input.toggleClass("is-invalid", false);
	};

	const pillEls = (): HTMLElement[] => Array.from(pills.querySelectorAll<HTMLElement>(".multi-select-pill"));

	/** Briefly highlight an existing pill, as Obsidian does for a duplicate. */
	const flash = (keyword: string) => {
		const index = opts.get().findIndex((k) => k.toLowerCase() === keyword.toLowerCase());
		const pill = pillEls()[index];
		if (!pill) return;
		pill.removeClass("multi-select-duplicate");
		void pill.offsetWidth; // restart the animation
		pill.addClass("multi-select-duplicate");
	};

	const renderPills = () => {
		pillEls().forEach((el) => el.remove());
		const keywords = opts.get();
		const valid = choices ? new Set(choices.items().map((c) => c.toLowerCase())) : null;
		keywords.forEach((keyword, index) => {
			const pill = createDiv({ cls: "multi-select-pill", attr: { tabindex: "0" } });
			pill.createDiv({ cls: "multi-select-pill-content" }).createSpan({ text: keyword });
			if (valid && !valid.has(keyword.toLowerCase())) {
				pill.addClass("is-invalid");
				pill.title = `No ${choices?.noun} has this name, so it does nothing`;
			} else if (!choices) {
				pill.title = "Double-click to edit";
			}
			const remove = pill.createDiv({
				cls: "multi-select-pill-remove-button",
				attr: { role: "button", "aria-label": `Remove ${keyword}` },
			});
			setIcon(remove, "x");
			// Keep focus where it is, so a blur doesn't re-render this pill mid-click
			remove.addEventListener("mousedown", (e) => e.preventDefault());
			remove.addEventListener("click", (e) => {
				e.stopPropagation();
				removeAt(index);
				input.focus();
			});
			if (!choices) {
				// Editing a pill takes it out and puts its text back in the box
				pill.addEventListener("dblclick", () => editAt(index));
			}
			pill.addEventListener("keydown", (e) => {
				// The settings list deletes the whole row on Delete/Backspace;
				// on a pill those keys mean this pill only
				e.stopPropagation();
				if (e.key === "Backspace" || e.key === "Delete") {
					e.preventDefault();
					removeAt(index);
					(pillEls()[Math.min(index, opts.get().length - 1)] ?? input).focus();
				} else if (e.key === "Enter" && !choices) {
					e.preventDefault();
					editAt(index);
				}
			});
			pills.insertBefore(pill, input);
		});
		input.setAttr("placeholder", keywords.length === 0 ? opts.placeholder : "Add…");
	};

	const removeAt = (index: number) => {
		opts.set(opts.get().filter((_, i) => i !== index));
		renderPills();
	};

	const editAt = (index: number) => {
		const keyword = opts.get()[index];
		if (keyword === undefined) return;
		commit();
		removeAt(index);
		setTyped(keyword);
		focusEnd(input);
	};

	/**
	 * Turn what's typed (plus `extra`, if given) into pills. With a fixed set
	 * of choices, anything that names none of them stays in the box.
	 */
	const commit = (extra = "") => {
		const raw = typed() + extra;
		setTyped("");
		let parts = splitList(raw);
		if (parts.length === 0) return;
		let leftover: string[] = [];
		if (choices) {
			const { matched, unmatched } = matchChoices(parts, choices.items());
			parts = matched;
			leftover = unmatched;
		}
		const before = opts.get();
		const seen = new Set(before.map((k) => k.toLowerCase()));
		parts.filter((p) => seen.has(p.toLowerCase())).forEach(flash);
		const next = mergeKeywords(before, parts.join(","));
		if (next.length !== before.length) {
			opts.set(next);
			renderPills();
		}
		if (leftover.length > 0) {
			setTyped(leftover.join(", "));
			input.addClass("is-invalid");
			input.title = `Not a ${choices?.noun}`;
		}
	};

	input.addEventListener("keydown", (e) => {
		// The settings list deletes the whole row on Delete/Backspace
		e.stopPropagation();
		if (e.isComposing) return;
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			// An open suggestion list handles Enter itself
			if (e.key === "Enter" && choices && suggest?.isOpen()) return;
			commit();
		} else if (e.key === "Backspace" && typed() === "" && opts.get().length > 0) {
			e.preventDefault();
			removeAt(opts.get().length - 1);
		}
	});
	input.addEventListener("input", () => input.toggleClass("is-invalid", false));
	input.addEventListener("paste", (e) => {
		// Always paste plain text: the box is contenteditable
		e.preventDefault();
		const pasted = e.clipboardData?.getData("text") ?? "";
		if (/[,\n]/.test(pasted)) commit(pasted);
		else insertText(input, pasted);
	});
	input.addEventListener("blur", () => {
		if (!suggest?.isOpen()) commit();
	});
	// Clicking the empty part of the box types into it
	pills.addEventListener("click", (e) => {
		if (e.target === pills) input.focus();
	});

	let suggest: ChoiceSuggest | null = null;
	if (choices) {
		suggest = new ChoiceSuggest(choices.app, input, () => {
			const taken = new Set(opts.get().map((k) => k.toLowerCase()));
			return choices.items().filter((c) => !taken.has(c.toLowerCase()));
		});
		suggest.onSelect((value) => {
			setTyped("");
			suggest?.close();
			const before = opts.get();
			const next = mergeKeywords(before, value);
			if (next.length !== before.length) {
				opts.set(next);
				renderPills();
			}
			input.focus();
		});
	}

	// ─── Plain text ──────────────────────────────────────────────────────────
	const textarea = field.createEl("textarea", {
		cls: "cookbook-row-textarea",
		attr: { rows: "1", "aria-labelledby": labelId, spellcheck: "false" },
	});
	textarea.placeholder = opts.placeholder;
	textarea.addEventListener("input", () => {
		fitHeight(textarea);
		opts.set(mergeKeywords([], textarea.value));
	});

	let asText = false;
	const applyMode = () => {
		field.toggleClass("is-text", asText);
		modeBtn?.setText(asText ? "Done" : "Edit as text");
		if (asText) {
			textarea.value = opts.get().join(", ");
			fitHeight(textarea);
		} else {
			renderPills();
		}
	};
	modeBtn?.addEventListener("click", () => {
		if (!asText) commit();
		asText = !asText;
		applyMode();
		(asText ? textarea : input).focus();
	});
	applyMode();

	return {
		focus: () => (asText ? textarea : input).focus(),
		fit: () => fitHeight(textarea),
		destroy: () => suggest?.close(),
	};
}

/** Offers the allowed choices that contain what's typed. */
class ChoiceSuggest extends AbstractInputSuggest<string> {
	private showing = false;

	constructor(
		app: App,
		inputEl: HTMLDivElement,
		private readonly items: () => string[],
	) {
		super(app, inputEl);
	}

	isOpen(): boolean {
		return this.showing;
	}

	protected getSuggestions(query: string): string[] {
		const q = query.trim().toLowerCase();
		return this.items().filter((item) => item.toLowerCase().includes(q));
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	override open(): void {
		this.showing = true;
		super.open();
	}

	override close(): void {
		this.showing = false;
		super.close();
	}
}

/** Insert plain text at the caret in a contenteditable element. */
function insertText(el: HTMLElement, text: string): void {
	const selection = el.win.getSelection();
	if (!selection || selection.rangeCount === 0 || !el.contains(selection.anchorNode)) {
		el.appendText(text);
		focusEnd(el);
		return;
	}
	const range = selection.getRangeAt(0);
	range.deleteContents();
	range.insertNode(el.doc.createTextNode(text));
	range.collapse(false);
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Focus a contenteditable element with the caret after its text. */
function focusEnd(el: HTMLElement): void {
	el.focus();
	const selection = el.win.getSelection();
	if (!selection) return;
	const range = el.doc.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

/** Grow a textarea to show all its text. Measures nothing while it's hidden. */
function fitHeight(el: HTMLTextAreaElement): void {
	if (!el.isConnected || el.offsetParent === null) return;
	el.setCssStyles({ height: "auto" });
	el.setCssStyles({ height: `${el.scrollHeight}px` });
}
