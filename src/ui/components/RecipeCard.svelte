<script lang="ts">
	import { getContext } from "svelte";
	import type { App } from "obsidian";
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { resolveCoverSrc } from "../../utils/coverImage";
	import { SvelteModalWrapper } from "../../utils/SvelteModalWrapper";
	import { cardMeta, isUntried } from "../../recipes/browse";
	import RecipeDetailModal from "../modals/RecipeDetailModal.svelte";
	import MultiplierControl from "./MultiplierControl.svelte";

	const app = getContext<App>("app");

	const {
		recipe = {},
		propsToShow = [] as string[],
		coverProp = "cover",
		cookSoonProp = "cook-soon",
		cookTogetherProp = "cook-together",
		onToggleCookSoon,
		onToggleCookTogether,
		onSetMultiplier,
		getOverlap,
	} = $props<{
		recipe: Record<string, any>;
		propsToShow?: string[];
		coverProp?: string;
		cookSoonProp?: string;
		cookTogetherProp?: string;
		onToggleCookSoon?: (path: string) => void;
		onToggleCookTogether?: (path: string) => void;
		onSetMultiplier?: (path: string, multiplier: number) => void;
		getOverlap?: (path: string) => import("../../recipes/overlap").OverlapMatch[];
	}>();

	// Covers may be URLs, vault paths or wikilinks — all need resolving to a src
	const coverSrc = $derived(resolveCoverSrc(app, recipe[coverProp], recipe.path as string));
	let coverFailed = $state(false);

	const title = $derived(String(recipe.title ?? recipe.path ?? "Untitled"));
	const cookSoon = $derived(!!recipe[cookSoonProp]);
	const together = $derived(!!recipe.cook_together);
	const multiplier = $derived((recipe.cook_multiplier as number | undefined) ?? 1);
	const meta = $derived(
		cardMeta(
			recipe,
			propsToShow.filter((k: string) => k !== coverProp && k !== cookSoonProp && k !== cookTogetherProp),
		),
	);
	const untried = $derived(isUntried(recipe));

	/** A theme colour picked by the title, so a recipe keeps its tile colour. */
	const TINTS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];
	const tint = $derived.by(() => {
		let hash = 0;
		for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
		return `var(--color-${TINTS[hash % TINTS.length]})`;
	});
	const initial = $derived(title.trim().charAt(0).toUpperCase() || "?");

	function openDetail() {
		new SvelteModalWrapper(app, RecipeDetailModal, {
			recipe,
			app,
			cookSoonProp,
			cookTogetherProp,
			coverProp,
			cooksWellWith: getOverlap?.(recipe.path) ?? [],
			onToggleCookSoon: () => onToggleCookSoon?.(recipe.path),
			onToggleCookTogether: () => onToggleCookTogether?.(recipe.path),
			onSetMultiplier: (m: number) => onSetMultiplier?.(recipe.path, m),
		}).open();
	}
</script>

<article class="cookbook-card" class:is-cook-soon={cookSoon}>
	<div class="cookbook-cover">
		{#if coverSrc && !coverFailed}
			<img src={coverSrc} alt="" loading="lazy" onerror={() => (coverFailed = true)} />
		{:else}
			<div class="cookbook-cover-tile" style:--tint={tint} aria-hidden="true">{initial}</div>
		{/if}
		{#if untried}
			<span class="cookbook-badge-new" title="Not tried yet">New</span>
		{/if}
	</div>

	<div class="cookbook-card-body">
		<h3 class="cookbook-card-title">
			<!-- Stretched over the whole card, so a click anywhere opens the recipe -->
			<button class="cookbook-card-open" onclick={openDetail}>{title}</button>
		</h3>
		{#if meta.length > 0}
			<p class="cookbook-card-meta">{meta.join(" · ")}</p>
		{/if}

		<div class="cookbook-card-actions">
			<span class="chip" class:is-on={cookSoon}>
				<button
					class="chip-toggle"
					aria-pressed={cookSoon}
					title={cookSoon ? "On the shopping list" : "Add to the shopping list"}
					onclick={() => onToggleCookSoon?.(recipe.path)}
				>
					<span class="chip-icon" use:obsidianIcon={"shopping-cart"} aria-hidden="true"></span>
					Cook soon
				</button>
				{#if cookSoon}
					<MultiplierControl
						compact
						value={multiplier}
						onDecrement={() => onSetMultiplier?.(recipe.path, Math.max(1, multiplier - 1))}
						onIncrement={() => onSetMultiplier?.(recipe.path, multiplier + 1)}
					/>
				{/if}
			</span>
			<span class="chip" class:is-on={together}>
				<button
					class="chip-toggle"
					aria-pressed={together}
					title={together ? "In the next cooking session" : "Cook in the next session"}
					onclick={() => onToggleCookTogether?.(recipe.path)}
				>
					<span class="chip-icon" use:obsidianIcon={"cooking-pot"} aria-hidden="true"></span>
					Together
				</button>
			</span>
		</div>
	</div>
</article>

<style>
	.cookbook-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		text-align: start;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		overflow: hidden;
		box-sizing: border-box;
		min-width: 0;
	}

	@media (prefers-reduced-motion: no-preference) {
		.cookbook-card {
			transition: border-color 0.15s, box-shadow 0.15s;
		}
	}

	.cookbook-card:hover {
		border-color: var(--background-modifier-border-hover);
		box-shadow: var(--shadow-s);
	}

	.cookbook-card.is-cook-soon {
		border-color: var(--interactive-accent);
	}

	.cookbook-card:has(.cookbook-card-open:focus-visible) {
		box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
	}

	/* Every card's cover is the same shape, image or not */
	.cookbook-cover {
		position: relative;
		display: block;
		width: 100%;
		overflow: hidden;
		aspect-ratio: 16 / 10;
		background: var(--background-primary-alt);
	}

	.cookbook-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cookbook-cover-tile {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--tint) 18%, var(--background-secondary));
		color: color-mix(in srgb, var(--tint) 75%, var(--text-normal));
		font-size: 2.6em;
		font-weight: var(--font-semibold);
	}

	.cookbook-badge-new {
		position: absolute;
		top: var(--size-4-2);
		left: var(--size-4-2);
		padding: 1px 8px;
		border-radius: var(--radius-l);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-size: var(--font-ui-smaller);
		font-weight: var(--font-semibold);
	}

	.cookbook-card-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
		padding: var(--size-4-2) var(--size-4-3) var(--size-4-3);
	}

	.cookbook-card-title {
		margin: 0;
		font-size: var(--font-ui-medium);
		font-weight: var(--font-semibold);
		line-height: 1.3;
	}

	.cookbook-card-open {
		all: unset;
		cursor: pointer;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}

	.cookbook-card-open::after {
		content: "";
		position: absolute;
		inset: 0;
	}

	.cookbook-card-meta {
		margin: 0;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Above the stretched open button, so they stay clickable */
	.cookbook-card-actions {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-1);
		margin-top: auto;
		padding-top: var(--size-4-2);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-l);
		background: var(--background-primary);
		overflow: hidden;
	}

	.chip.is-on {
		border-color: var(--interactive-accent);
		background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-primary));
	}

	.chip-toggle {
		all: unset;
		display: inline-flex;
		align-items: center;
		gap: var(--size-2-2);
		padding: var(--size-2-2) var(--size-4-2);
		min-height: 28px;
		box-sizing: border-box;
		cursor: pointer;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.chip.is-on .chip-toggle {
		color: var(--text-normal);
	}

	.chip-toggle:hover {
		color: var(--text-normal);
	}

	.chip-toggle:focus-visible {
		box-shadow: inset 0 0 0 2px var(--background-modifier-border-focus);
	}

	.chip-icon {
		display: inline-flex;
		--icon-size: 14px;
	}
</style>
