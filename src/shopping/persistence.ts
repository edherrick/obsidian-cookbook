import { normalizePath, TFile } from "obsidian";
import type { App } from "obsidian";
import type { PersistedShoppingList, ShoppingItem } from "../types";
import { formatQty } from "../ingredients/units";
import { UNCATEGORIZED } from "../ingredients/categorize";
import { SerialQueue } from "../utils/serialQueue";

const JSON_FENCE = "%%";

/** Items in the order they are rendered: grouped by category, categories in order. */
export function getItemsInDisplayOrder(data: PersistedShoppingList): ShoppingItem[] {
	const byCategory = new Map<string, ShoppingItem[]>();
	for (const item of data.items) {
		const cat = item.category || UNCATEGORIZED;
		if (!byCategory.has(cat)) byCategory.set(cat, []);
		byCategory.get(cat)!.push(item);
	}
	const orderedCats = [
		...data.categoryOrder.filter((c) => byCategory.has(c)),
		...[...byCategory.keys()].filter((c) => !data.categoryOrder.includes(c)),
	];
	const result: ShoppingItem[] = [];
	for (const cat of orderedCats) result.push(...byCategory.get(cat)!);
	return result;
}

export function serializeShoppingList(data: PersistedShoppingList): string {
	const lines: string[] = ["# Shopping List"];
	if (data.generatedAt) {
		lines.push(`_Generated: ${new Date(data.generatedAt).toLocaleString()}_`);
	}

	let currentCat = "";
	for (const item of getItemsInDisplayOrder(data)) {
		const cat = item.category || UNCATEGORIZED;
		if (cat !== currentCat) {
			lines.push("", `## ${cat}`);
			currentCat = cat;
		}
		const check = item.checked ? "x" : " ";
		const qty = item.quantity !== null ? `${formatQty(item.quantity)} ` : "";
		const unit = item.unit ? `${item.unit} ` : "";
		const prep = item.prep ? `, ${item.prep}` : "";
		lines.push(`- [${check}] ${qty}${unit}${item.text}${prep}`);
	}

	lines.push("", JSON_FENCE, JSON.stringify(data), JSON_FENCE);
	return lines.join("\n");
}

export function parseShoppingListFromMarkdown(content: string): PersistedShoppingList | null {
	const start = content.lastIndexOf(`\n${JSON_FENCE}\n`);
	if (start === -1) return null;
	const jsonStart = start + JSON_FENCE.length + 2;
	const end = content.indexOf(`\n${JSON_FENCE}`, jsonStart);
	if (end === -1) return null;

	let data: PersistedShoppingList;
	try {
		data = JSON.parse(content.slice(jsonStart, end)) as PersistedShoppingList;
	} catch {
		return null;
	}

	// Overlay checked state from the markdown body — the user edits checkboxes
	// in the rendered note, not the %% JSON block, so we reconcile here.
	const body = content.slice(0, start);
	const checkboxStates = body
		.split("\n")
		.filter((line) => /^\s*[-*]\s\[[ xX]\]\s/.test(line))
		.map((line) => /\[[xX]\]/.test(line));
	const orderedItems = getItemsInDisplayOrder(data);
	if (checkboxStates.length === orderedItems.length) {
		orderedItems.forEach((item, i) => {
			item.checked = checkboxStates[i]!;
		});
	}

	return data;
}

export interface ShoppingListPersistenceDeps {
	app: App;
	/** Vault path to write to, or undefined for plugin storage. */
	getFilePath: () => string | undefined;
	loadData: () => Promise<Record<string, unknown>>;
	saveData: (data: Record<string, unknown>) => Promise<void>;
}

/**
 * Reads and writes the shopping list, either to plugin storage or to a
 * markdown note in the vault. All writes go through one serial queue shared
 * with settings saves so a read-modify-write can't interleave.
 */
export class ShoppingListPersistence {
	private lastWrittenContent = "";

	constructor(
		private readonly deps: ShoppingListPersistenceDeps,
		private readonly queue: SerialQueue,
	) {}

	/** Absolute vault path of the configured note, or null when unset. */
	resolvePath(): string | null {
		const raw = this.deps.getFilePath()?.trim();
		if (!raw) return null;
		const p = normalizePath(raw);
		const filename = p.split("/").pop() ?? p;
		return filename.includes(".") ? p : `${p}.md`;
	}

	/** True when this file change was written by us and should not echo back. */
	isOwnWrite(content: string): boolean {
		return content === this.lastWrittenContent;
	}

	save(data: PersistedShoppingList): Promise<void> {
		return this.queue.run(async () => {
			const path = this.resolvePath();
			if (path) {
				await this.saveToFile(path, data);
			} else {
				const existing = await this.deps.loadData();
				await this.deps.saveData({ ...existing, shoppingList: data });
			}
		});
	}

	async load(): Promise<PersistedShoppingList | null> {
		const path = this.resolvePath();
		if (path) {
			const file = this.deps.app.vault.getFileByPath(path);
			if (!file) return null;
			return parseShoppingListFromMarkdown(await this.deps.app.vault.read(file));
		}
		const data = await this.deps.loadData();
		return (data.shoppingList as PersistedShoppingList | undefined) ?? null;
	}

	private async saveToFile(path: string, data: PersistedShoppingList): Promise<void> {
		try {
			const content = serializeShoppingList(data);
			const parts = path.split("/");
			if (parts.length > 1) {
				await this.ensureDirectoryExists(parts.slice(0, -1).join("/"));
			}
			// Set before the write so the modify event handler recognises this as ours
			this.lastWrittenContent = content;
			const file = this.deps.app.vault.getFileByPath(path);
			if (file instanceof TFile) {
				await this.deps.app.vault.modify(file, content);
			} else {
				await this.deps.app.vault.create(path, content);
			}
		} catch (e) {
			console.error("cookbook: failed to save shopping list to vault file", e);
		}
	}

	private async ensureDirectoryExists(dir: string): Promise<void> {
		if (!dir || dir === ".") return;
		if (await this.deps.app.vault.adapter.exists(dir)) return;
		const parent = dir.split("/").slice(0, -1).join("/");
		if (parent) await this.ensureDirectoryExists(parent);
		await this.deps.app.vault.adapter.mkdir(dir);
	}
}
