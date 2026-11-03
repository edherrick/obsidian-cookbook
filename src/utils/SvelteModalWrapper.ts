import { App, Modal } from "obsidian";
import type { Component } from "svelte";
import { mountSvelte } from "./mountSvelte";

export class SvelteModalWrapper extends Modal {
	private destroy: (() => void) | null = null;

	constructor(
		app: App,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		private readonly ComponentClass: Component<any>,
		private readonly props: Record<string, unknown> = {},
	) {
		super(app);
	}

	onOpen(): void {
		this.destroy = mountSvelte(this.ComponentClass, this.contentEl, {
			...this.props,
			close: () => this.close(),
		});
	}

	onClose(): void {
		this.destroy?.();
		this.destroy = null;
	}
}
