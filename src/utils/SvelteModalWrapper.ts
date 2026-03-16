import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { Component } from "svelte";

export class SvelteModalWrapper extends Modal {
	private component: Record<string, unknown> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly ComponentClass: Component<any>;
	private readonly props: Record<string, unknown>;

	constructor(
		app: App,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ComponentClass: Component<any>,
		props: Record<string, unknown> = {},
	) {
		super(app);
		this.ComponentClass = ComponentClass;
		this.props = props;
	}

	onOpen(): void {
		this.component = mount(this.ComponentClass, {
			target: this.contentEl,
			props: {
				...this.props,
				close: () => this.close(),
			},
		}) as Record<string, unknown>;
	}

	onClose(): void {
		if (this.component) {
			void unmount(this.component);
		}
	}
}
