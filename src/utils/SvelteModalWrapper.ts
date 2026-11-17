import { App, Modal } from "obsidian";
import type { Component } from "svelte";
import { mountSvelte } from "./mountSvelte";

/** Hosts a Svelte component in a modal, passing it a `close` prop. */
export class SvelteModalWrapper<Props extends Record<string, unknown>> extends Modal {
	/** Every Cookbook window currently open, so one action can close them all. */
	private static readonly open = new Set<SvelteModalWrapper<Record<string, unknown>>>();

	/** Close every open Cookbook window, e.g. before showing a note behind them. */
	static closeAll(): void {
		for (const modal of [...SvelteModalWrapper.open]) modal.close();
	}

	private destroy: (() => void) | null = null;

	constructor(
		app: App,
		private readonly component: Component<Props>,
		private readonly props: Omit<Props, "close">,
	) {
		super(app);
	}

	onOpen(): void {
		// Sizes this window (see styles.css) without touching other plugins' modals
		this.modalEl.addClass("cookbook-modal");
		SvelteModalWrapper.open.add(this);
		// Callers pass every prop except close; adding it here completes Props
		const props = { ...this.props, close: () => this.close() } as unknown as Props;
		this.destroy = mountSvelte(this.component, this.contentEl, props);
	}

	onClose(): void {
		SvelteModalWrapper.open.delete(this);
		this.destroy?.();
		this.destroy = null;
	}
}
