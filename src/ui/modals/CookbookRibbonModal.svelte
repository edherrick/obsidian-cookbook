<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { onDestroy, onMount } from "svelte";
	import MultiplierControl from "../components/MultiplierControl.svelte";
	import { Notice } from "obsidian";
	import {
		applyClearFlag,
		applyToggleCookSoon,
		applyToggleCookTogether,
		applySetMultiplier,
	} from "../../recipes/repository";
	import type { Recipe } from "../../recipes/repository";

	const {
		openRecipeModal,
		generateShoppingList,
		createCookSession,
		refreshRecipes,
		stores,
		app,
		close,
		cookSoonProp = "cook-soon",
		cookTogetherProp = "cook-together",
	} = $props<{
		openRecipeModal: () => void;
		generateShoppingList: () => Promise<void>;
		createCookSession: (markCookSoon: boolean) => Promise<void>;
		refreshRecipes: () => Promise<void>;
		stores: import("../../recipes/recipeStores").RecipeStores;
		app: import("obsidian").App;
		close: () => void;
		cookSoonProp?: string;
		cookTogetherProp?: string;
	}>();

	// svelte-ignore state_referenced_locally — stores is a stable reference
	const { selectedRecipes, cookTogetherRecipes } = stores;

	let generating = $state(false);
	let startingSession = $state(false);
	let alsoCookSoon = $state(false);

	onMount(() => {
		void refreshRecipes();
	});

	function toggleCookSoon(path: string) {
		applyToggleCookSoon(stores.recipes, path, app, cookSoonProp);
	}

	function setMultiplier(path: string, multiplier: number) {
		applySetMultiplier(stores.recipes, path, multiplier);
	}

	function toggleCookTogether(path: string) {
		applyToggleCookTogether(stores.recipes, path, app, cookTogetherProp);
	}

	// ─── Clear a whole list (two clicks, since it rewrites every recipe note) ──
	type ListKind = "shopping" | "session";
	let confirming: ListKind | null = $state(null);
	let confirmTimer: number | null = null;
	onDestroy(() => {
		if (confirmTimer !== null) window.clearTimeout(confirmTimer);
	});

	function clearList(kind: ListKind) {
		if (confirming !== kind) {
			confirming = kind;
			if (confirmTimer !== null) window.clearTimeout(confirmTimer);
			confirmTimer = window.setTimeout(() => (confirming = null), 3000);
			return;
		}
		if (confirmTimer !== null) window.clearTimeout(confirmTimer);
		confirming = null;
		const n =
			kind === "shopping"
				? applyClearFlag(stores.recipes, app, "cook_soon", cookSoonProp)
				: applyClearFlag(stores.recipes, app, "cook_together", cookTogetherProp);
		const where = kind === "shopping" ? "the shopping list" : "the cook session";
		new Notice(`Took ${n} recipe${n === 1 ? "" : "s"} off ${where}.`);
	}

	async function handleStartSession() {
		startingSession = true;
		try {
			await createCookSession(alsoCookSoon);
			close();
		} finally {
			startingSession = false;
		}
	}

	async function handleGenerate() {
		generating = true;
		try {
			await generateShoppingList();
			close();
		} finally {
			generating = false;
		}
	}
</script>

<div class="ribbon-modal-content">
	{#if $selectedRecipes && $selectedRecipes.length > 0}
		<div class="selected-recipes">
			<div class="section-head">
				<h3>Shopping list</h3>
				<button
					class="clear-btn"
					class:is-confirming={confirming === "shopping"}
					onclick={() => clearList("shopping")}
					title="Take every recipe off the shopping list"
				>{confirming === "shopping" ? "Click again to clear" : "Clear"}</button>
			</div>
			<ul>
				{#each $selectedRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={recipe.cook_soon}
							aria-label="{(recipe as Recipe).title ?? (recipe as Recipe).path} on the shopping list"
							onchange={() => toggleCookSoon(recipe.path)}
						/>
						<span class="recipe-title">{(recipe as Recipe).title ?? (recipe as Recipe).path}</span>
						<span class="mult-push">
							<MultiplierControl
								value={recipe.cook_multiplier ?? 1}
								onDecrement={() => setMultiplier(recipe.path, Math.max(1, (recipe.cook_multiplier ?? 1) - 1))}
								onIncrement={() => setMultiplier(recipe.path, (recipe.cook_multiplier ?? 1) + 1)}
							/>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="no-selection">
			No recipes on the shopping list. Open the Cookbook and select
			Shopping list on a recipe.
		</p>
	{/if}

	{#if $cookTogetherRecipes && $cookTogetherRecipes.length > 0}
		<div class="selected-recipes">
			<div class="section-head">
				<h3>Cook session</h3>
				<button
					class="clear-btn"
					class:is-confirming={confirming === "session"}
					onclick={() => clearList("session")}
					title="Take every recipe out of the cook session"
				>{confirming === "session" ? "Click again to clear" : "Clear"}</button>
			</div>
			<ul>
				{#each $cookTogetherRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={!!recipe.cook_together}
							aria-label="{(recipe as Recipe).title ?? (recipe as Recipe).path} in the cook session"
							onchange={() => toggleCookTogether(recipe.path)}
						/>
						<span class="recipe-title">{(recipe as Recipe).title ?? (recipe as Recipe).path}</span>
					</li>
				{/each}
			</ul>
			<label class="session-option">
				<input type="checkbox" bind:checked={alsoCookSoon} />
				Also put them on the shopping list
			</label>
		</div>
	{/if}

	<div class="cookbook-btn-row">
		<button class="cookbook-btn" onclick={openRecipeModal}>
			<span use:obsidianIcon={"book-open"} class="cookbook-btn-icon"></span>
			<span class="cookbook-btn-label">Open Cookbook</span>
		</button>

		<button class="cookbook-btn" onclick={handleGenerate} disabled={generating}>
			<span
				use:obsidianIcon={"shopping-cart"}
				class="cookbook-btn-icon"
			></span>
			<span class="cookbook-btn-label"
				>{generating
					? "Generating…"
					: "Generate Shopping List"}</span
			>
		</button>

		{#if $cookTogetherRecipes && $cookTogetherRecipes.length > 0}
			<button class="cookbook-btn" onclick={handleStartSession} disabled={startingSession}>
				<span use:obsidianIcon={"cooking-pot"} class="cookbook-btn-icon"></span>
				<span class="cookbook-btn-label">{startingSession ? "Writing…" : "Start Cooking Session"}</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.ribbon-modal-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: min(280px, 100%);
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.selected-recipes h3 {
		margin: 0;
		font-weight: bold;
	}

	.clear-btn {
		height: auto;
		padding: 2px 10px;
		font-size: var(--font-ui-smaller);
		background: none;
		box-shadow: none;
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
	}

	.clear-btn:hover,
	.clear-btn.is-confirming {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.selected-recipes ul {
		margin: 0;
		padding-left: 0;
		list-style: none;
		max-height: 200px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.selected-recipes li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9em;
	}

	.recipe-title {
		flex: 1;
	}

	.mult-push {
		margin-left: auto;
		display: flex;
	}

	.session-option {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin: 0.5rem 0 0;
	}

	.no-selection {
		color: var(--text-muted);
		font-size: 0.9em;
		margin: 0;
	}

	.cookbook-btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.cookbook-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1 1 0;
		min-width: max-content;
		justify-content: center;
	}
</style>
