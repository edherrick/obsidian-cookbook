import { AbstractInputSuggest, App, TAbstractFile, TFile, TFolder, setIcon } from "obsidian";

export type PathSuggestMode = "folder" | "file" | "any";

/**
 * Autocomplete for vault paths. `mode` decides whether folders, files or both
 * are offered — one class covers every suggester the settings tab needs.
 */
export class PathSuggest extends AbstractInputSuggest<TAbstractFile> {
	private readonly textInputEl: HTMLInputElement;
	private readonly mode: PathSuggestMode;

	constructor(app: App, inputEl: HTMLInputElement, mode: PathSuggestMode = "any") {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.mode = mode;
	}

	private accepts(f: TAbstractFile): boolean {
		if (f.path === "/") return false;
		if (this.mode === "folder") return f instanceof TFolder;
		if (this.mode === "file") return f instanceof TFile;
		return f instanceof TFile || f instanceof TFolder;
	}

	getSuggestions(inputStr: string): TAbstractFile[] {
		const lower = inputStr.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f) => this.accepts(f) && f.path.toLowerCase().includes(lower))
			.slice(0, 100);
	}

	renderSuggestion(file: TAbstractFile, el: HTMLElement): void {
		el.addClass("cookbook-suggest-item");
		const iconEl = el.createSpan();
		setIcon(iconEl, file instanceof TFolder ? "folder" : "file");
		el.createSpan({ text: file.path });
	}

	selectSuggestion(file: TAbstractFile): void {
		this.setValue(file.path);
		this.textInputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}
