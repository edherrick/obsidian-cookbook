// src/ui/actions/obsidianIcon.ts
import { setIcon } from "obsidian";

export function obsidianIcon(node: HTMLElement, iconName: string) {
	let raf: number | null = null;

	const apply = (name: string) => {
		raf = window.requestAnimationFrame(() => {
			raf = null;
			setIcon(node, name);
		});
	};

	apply(iconName);

	return {
		update(newName: string) {
			if (raf !== null) window.cancelAnimationFrame(raf);
			node.empty?.();
			apply(newName);
		},
		destroy() {
			if (raf !== null) window.cancelAnimationFrame(raf);
		},
	};
}
