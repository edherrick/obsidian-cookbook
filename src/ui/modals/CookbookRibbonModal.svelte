<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { onMount } from "svelte";
	import MultiplierControl from "../components/MultiplierControl.svelte";
	import {
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
			<h3>Selected Recipes</h3>
			<ul>
				{#each $selectedRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={recipe.cook_soon}
							aria-label="Cook {(recipe as Recipe).title ?? (recipe as Recipe).path} soon"
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
			No recipes selected. Open the Cookbook and mark recipes as
			"cook soon".
		</p>
	{/if}

	{#if $cookTogetherRecipes && $cookTogetherRecipes.length > 0}
		<div class="selected-recipes">
			<h3>Cook together</h3>
			<ul>
				{#each $cookTogetherRecipes as recipe (recipe.path)}
					<li>
						<input
							type="checkbox"
							checked={!!recipe.cook_together}
							aria-label="Cook {(recipe as Recipe).title ?? (recipe as Recipe).path} together"
							onchange={() => toggleCookTogether(recipe.path)}
						/>
						<span class="recipe-title">{(recipe as Recipe).title ?? (recipe as Recipe).path}</span>
					</li>
				{/each}
			</ul>
			<label class="session-option">
				<input type="checkbox" bind:checked={alsoCookSoon} />
				Also mark them cook soon (for the shopping list)
			</label>
		</div>
	{/if}

	<div class="btn-row">
		<button class="btn" onclick={openRecipeModal}>
			<span use:obsidianIcon={"book-open"} class="btn-icon"></span>
			<span class="btn-label">Open Cookbook</span>
		</button>

		<button class="btn" onclick={handleGenerate} disabled={generating}>
			<span
				use:obsidianIcon={"shopping-cart"}
				class="btn-icon"
			></span>
			<span class="btn-label"
				>{generating
					? "Generating…"
					: "Generate Shopping List"}</span
			>
		</button>

		{#if $cookTogetherRecipes && $cookTogetherRecipes.length > 0}
			<button class="btn" onclick={handleStartSession} disabled={startingSession}>
				<span use:obsidianIcon={"cooking-pot"} class="btn-icon"></span>
				<span class="btn-label">{startingSession ? "Writing…" : "Start Cooking Session"}</span>
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

	.selected-recipes h3 {
		margin: 0 0 0.5rem;
		font-weight: bold;
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

	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1 1 0;
		min-width: max-content;
		justify-content: center;
	}
</style>
