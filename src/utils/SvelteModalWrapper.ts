import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";

type SvelteComponent = any;

export class SvelteModalWrapper extends Modal {
	private component: any;
	private Component: SvelteComponent;
	private props: Record<string, any>;

	constructor(
		app: App,
		Component: SvelteComponent,
		props: Record<string, any> = {}
	) {
		super(app);
		this.Component = Component;
		this.props = props;
	}

	onOpen() {
		this.component = mount(this.Component, {
			target: this.contentEl,
			props: {
				...this.props,
				close: () => this.close(),
			},
		});
	}

	onClose() {
		if (this.component) {
			unmount(this.component);
		}
	}
}
