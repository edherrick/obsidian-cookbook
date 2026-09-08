import type { App } from "obsidian";

/**
 * Turn a `cover` frontmatter value into something an <img src> can load.
 *
 * Accepts a bare URL, a data URI, a wikilink (`[[cover.png]]`, `![[cover.png]]`),
 * a markdown image (`![](cover.png)`) or a vault-relative path. Vault paths are
 * resolved through the metadata cache so an attachment renders like it does in
 * the note, instead of silently showing nothing.
 */
export function resolveCoverSrc(app: App, value: unknown, sourcePath: string): string | null {
	if (typeof value !== "string") return null;
	const raw = value.trim();
	if (!raw) return null;

	let target = raw;

	const wikilink = /^!?\[\[([^\]]+)\]\]$/.exec(raw);
	if (wikilink) target = (wikilink[1]!.split("|")[0] ?? "").trim();

	const markdownImage = /^!?\[[^\]]*\]\(([^)]+)\)$/.exec(target);
	if (markdownImage) target = markdownImage[1]!.trim();

	if (!target) return null;
	if (/^(?:https?:|data:|app:|file:|blob:)/i.test(target)) return target;

	const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	if (file) return app.vault.getResourcePath(file);

	return target;
}
