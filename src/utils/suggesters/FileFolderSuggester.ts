import { AbstractInputSuggest, App, TAbstractFile, TFile, TFolder, setIcon } from "obsidian";

export class FileFolderSuggester extends AbstractInputSuggest<TAbstractFile> {
	private readonly textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.textInputEl = inputEl;
	}

	getSuggestions(inputStr: string): TAbstractFile[] {
		const lower = inputStr.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter(
				(f): f is TFile | TFolder =>
					(f instanceof TFile || f instanceof TFolder) &&
					f.path !== "/" &&
					f.path.toLowerCase().includes(lower),
			)
			.slice(0, 50);
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
