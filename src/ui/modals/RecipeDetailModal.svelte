<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { MarkdownRenderer, Component, TFile } from "obsidian";
	import type { App } from "obsidian";
	import type { Recipe } from "../../utils/recipeUtils";
	import { obsidianIcon } from "../../utils/obsidianIcon";

	const { recipe, app, close, onToggleCookSoon } = $props<{
		recipe: Recipe;
		app: App;
		close: () => void;
		onToggleCookSoon?: () => void;
	}>();

	const HIDDEN_KEYS = new Set([
		"path",
		"__tags",
		"position",
		"title",
		"cover",
		"tags",
		"cook_soon",
		"cook-soon",
	]);

	let contentEl: HTMLDivElement;
	let loading = $state(true);
	let error = $state<string | null>(null);
	// svelte-ignore state_referenced_locally — recipe is stable for this modal's lifetime
	let cookSoon = $state(!!recipe.cook_soon);
	let renderComp: Component | null = null;

	// recipe is a stable prop — capture once, it never changes for this modal
	// svelte-ignore state_referenced_locally
	const infoFields = Object.entries(recipe).filter(
		([k]) => !HIDDEN_KEYS.has(k) && !k.startsWith("__"),
	);

	// svelte-ignore state_referenced_locally
	const tags = (recipe.__tags ?? []).map((t: string) => t.replace(/^#/, ""));

	onMount(async () => {
		const file = app.vault.getAbstractFileByPath(recipe.path);
		if (!(file instanceof TFile)) {
			error = "Could not find recipe file.";
			loading = false;
			return;
		}

		try {
			const raw = await app.vault.read(file);
			// Strip YAML frontmatter block before rendering
			const body = raw.replace(/^---[\s\S]*?---\n?/, "").trimStart();

			renderComp = new Component();
			renderComp.load();

			await MarkdownRenderer.render(
				app,
				body,
				contentEl,
				recipe.path,
				renderComp,
			);
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		renderComp?.unload();
	});

	function handleToggleCookSoon() {
		cookSoon = !cookSoon;
		onToggleCookSoon?.();
	}

	function openInObsidian() {
		app.workspace.openLinkText(recipe.path, "", false);
		close();
	}
</script>

<div class="recipe-detail">
	<!-- Cover -->
	{#if recipe.cover}
		<img class="cover" src={recipe.cover} alt={recipe.title} />
	{/if}

	<!-- Header -->
	<div class="header">
		<h1 class="title">{recipe.title ?? recipe.path}</h1>

		{#if tags.length > 0}
			<div class="tags">
				{#each tags as tag}
					<span class="tag">#{tag}</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Frontmatter info grid -->
	{#if infoFields.length > 0}
		<div class="info-grid">
			{#each infoFields as [key, val]}
				<span class="info-key">{key}</span>
				<span class="info-val">{val}</span>
			{/each}
		</div>
	{/if}

	<!-- Actions -->
	<div class="actions">
		<label class="cook-soon-toggle">
			<input
				type="checkbox"
				checked={cookSoon}
				onchange={handleToggleCookSoon}
			/>
			Cook soon
		</label>

		<button class="open-btn" onclick={openInObsidian}>
			<span use:obsidianIcon={"square-arrow-out-up-right"} class="btn-icon"></span>
			Open in Obsidian
		</button>
	</div>

	<hr class="divider" />

	<!-- Rendered markdown body -->
	<div class="markdown-body">
		{#if loading}
			<p class="loading">Loading…</p>
		{:else if error}
			<p class="error">{error}</p>
		{/if}
		<!-- MarkdownRenderer writes into this element -->
		<div bind:this={contentEl}></div>
	</div>
</div>

<style>
	.recipe-detail {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 680px;
		width: 100%;
	}

	.cover {
		width: 100%;
		max-height: 260px;
		object-fit: cover;
		border-radius: var(--radius-m);
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.title {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.3;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.tag {
		font-size: 0.78em;
		color: var(--tag-color, var(--text-accent));
		background: var(--tag-background, var(--background-modifier-border));
		padding: 1px 7px;
		border-radius: 99px;
	}

	.info-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: 0.75rem;
		row-gap: 0.2rem;
		font-size: 0.88em;
		background: var(--background-secondary);
		padding: 0.6rem 0.75rem;
		border-radius: var(--radius-s);
	}

	.info-key {
		font-weight: 600;
		color: var(--text-muted);
		text-align: right;
		white-space: nowrap;
	}

	.info-val {
		color: var(--text-normal);
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.cook-soon-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9em;
		cursor: pointer;
	}

	.open-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.85em;
		margin-left: auto;
	}

	.btn-icon {
		width: 14px;
		height: 14px;
	}

	.divider {
		margin: 0;
		border: none;
		border-top: 1px solid var(--background-modifier-border);
	}

	.markdown-body {
		font-size: 0.92em;
		line-height: 1.65;
		overflow-y: auto;
		max-height: 50vh;
		padding-right: 4px;
	}

	.loading,
	.error {
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.error {
		color: var(--text-error);
	}
</style>
