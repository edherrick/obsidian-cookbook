import { FuzzySuggestModal, TFolder } from "obsidian";
import type { App, TAbstractFile } from "obsidian";

/** Pick any file or folder in the vault. */
export class PathPickerModal extends FuzzySuggestModal<TAbstractFile> {
	constructor(
		app: App,
		private readonly onPick: (path: string) => void,
	) {
		super(app);
		this.setPlaceholder("Choose a file or folder to ignore");
	}

	getItems(): TAbstractFile[] {
		return this.app.vault.getAllLoadedFiles().filter((f) => f.path !== "/");
	}

	getItemText(file: TAbstractFile): string {
		return file instanceof TFolder ? `${file.path}/` : file.path;
	}

	onChooseItem(file: TAbstractFile): void {
		this.onPick(file.path);
	}
}
