// Minimal stub of the Obsidian API for use in unit tests.
// Only exports what the tested modules actually reference at runtime.

export class TFile {
	path: string;
	basename: string;
	constructor(path: string) {
		this.path = path;
		this.basename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path;
	}
}
