import { mount, unmount } from "svelte";
import type { Component } from "svelte";

/** Mount a Svelte component and return a function that unmounts it. */
export function mountSvelte(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: Component<any>,
	target: HTMLElement,
	props: Record<string, unknown>,
): () => void {
	const instance = mount(component, { target, props });
	return () => void unmount(instance);
}
