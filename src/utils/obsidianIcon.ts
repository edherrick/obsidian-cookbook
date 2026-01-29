// src/ui/actions/obsidianIcon.ts
import { setIcon } from "obsidian";

export function obsidianIcon(node: HTMLElement, iconName: string) {
	setIcon(node, iconName);

	return {
		update(newName: string) {
			node.empty?.();
			setIcon(node, newName);
		},
	};
}
