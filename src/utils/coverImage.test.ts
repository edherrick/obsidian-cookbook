import { describe, it, expect } from "vitest";
import type { App } from "obsidian";
import { resolveCoverSrc } from "./coverImage";

function appWithAttachment(known: Record<string, string>): App {
	return {
		metadataCache: {
			getFirstLinkpathDest: (link: string) => (known[link] ? { path: known[link] } : null),
		},
		vault: {
			getResourcePath: (file: { path: string }) => `app://vault/${file.path}`,
		},
	} as unknown as App;
}

const app = appWithAttachment({ "cover.png": "attachments/cover.png" });

describe("resolveCoverSrc", () => {
	it("passes an https URL straight through", () => {
		expect(resolveCoverSrc(app, "https://example.com/a.jpg", "Recipes/Soup.md")).toBe(
			"https://example.com/a.jpg",
		);
	});

	it("passes a data URI straight through", () => {
		expect(resolveCoverSrc(app, "data:image/png;base64,AAA", "Recipes/Soup.md")).toBe(
			"data:image/png;base64,AAA",
		);
	});

	it("resolves a wikilink to a vault resource path", () => {
		expect(resolveCoverSrc(app, "[[cover.png]]", "Recipes/Soup.md")).toBe(
			"app://vault/attachments/cover.png",
		);
	});

	it("resolves an embed", () => {
		expect(resolveCoverSrc(app, "![[cover.png]]", "Recipes/Soup.md")).toBe(
			"app://vault/attachments/cover.png",
		);
	});

	it("keeps the alias target of a piped wikilink", () => {
		expect(resolveCoverSrc(app, "[[cover.png|thumb]]", "Recipes/Soup.md")).toBe(
			"app://vault/attachments/cover.png",
		);
	});

	it("unwraps a markdown image", () => {
		expect(resolveCoverSrc(app, "![](https://example.com/a.jpg)", "Recipes/Soup.md")).toBe(
			"https://example.com/a.jpg",
		);
	});

	it("returns null for a missing or non-string value", () => {
		expect(resolveCoverSrc(app, undefined, "Recipes/Soup.md")).toBeNull();
		expect(resolveCoverSrc(app, "   ", "Recipes/Soup.md")).toBeNull();
		expect(resolveCoverSrc(app, 42, "Recipes/Soup.md")).toBeNull();
	});

	it("falls back to the raw value when the vault has no such file", () => {
		expect(resolveCoverSrc(app, "missing.png", "Recipes/Soup.md")).toBe("missing.png");
	});
});
