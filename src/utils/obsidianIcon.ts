// src/ui/actions/obsidianIcon.ts
import { setIcon } from "obsidian";

export function obsidianIcon(node: HTMLElement, iconName: string) {
	let raf: number | null = null;

	const apply = (name: string) => {
		raf = requestAnimationFrame(() => {
			raf = null;
			setIcon(node, name);
		});
	};

	apply(iconName);

	return {
		update(newName: string) {
			if (raf !== null) cancelAnimationFrame(raf);
			node.empty?.();
			apply(newName);
		},
		destroy() {
			if (raf !== null) cancelAnimationFrame(raf);
		},
	};
}
