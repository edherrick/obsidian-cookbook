import { mount, unmount } from "svelte";
import type { Component } from "svelte";

/** Mount a Svelte component and return a function that unmounts it. */
export function mountSvelte<Props extends Record<string, unknown>>(
	component: Component<Props>,
	target: HTMLElement,
	props: Props,
): () => void {
	const instance = mount(component, { target, props });
	return () => void unmount(instance);
}
