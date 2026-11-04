// Minimal stub of the Obsidian API for use in unit tests.
// Only exports what the tested modules actually reference at runtime.

export class TFile {
	path: string;
	basename: string;
	extension: string;
	constructor(path: string) {
		this.path = path;
		this.basename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path;
		this.extension = /\.([^./]+)$/.exec(path)?.[1] ?? "";
	}
}

export class TFolder {
	path: string;
	children: (TFile | TFolder)[];
	constructor(path: string, children: (TFile | TFolder)[] = []) {
		this.path = path;
		this.children = children;
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}
