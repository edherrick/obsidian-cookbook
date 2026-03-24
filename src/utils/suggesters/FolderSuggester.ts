import { AbstractInputSuggest, App, TFolder, setIcon } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): TFolder[] {
		const lower = inputStr.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter(
				(f): f is TFolder =>
					f instanceof TFolder &&
					f.path.toLowerCase().includes(lower),
			)
			.slice(0, 100);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.style.display = "flex";
		el.style.alignItems = "center";
		el.style.gap = "6px";
		const iconEl = el.createSpan();
		setIcon(iconEl, "folder");
		el.createSpan({ text: folder.path });
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.close();
	}
}
