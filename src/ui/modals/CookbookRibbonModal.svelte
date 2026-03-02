<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";

	const {
		openRecipeModal,
		generateShoppingList,
		selectedRecipes = [] as Record<string, any>[],
	} = $props<{
		openRecipeModal: () => void;
		generateShoppingList: () => void;
		recipes?: Record<string, any>[];
	}>();
</script>

<div class="ribbon-modal-content">
	<!-- Currently selected recipes -->
	{#if selectedRecipes.length > 0}
		<div class="selected-recipes">
			<h3>Selected Recipes</h3>
			<ul>
				{#each selectedRecipes as recipe (recipe.path)}
					<li>{recipe.title ?? recipe.path}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Buttons -->
	<div class="btn-row">
		<button class="btn" onclick={openRecipeModal}>
			<span use:obsidianIcon={"book-open"} class="btn-icon"></span>
			<span class="btn-label">Open Cookbook</span>
		</button>

		<button class="btn" onclick={generateShoppingList}>
			<span use:obsidianIcon={"shopping-cart"} class="btn-icon"></span>
			<span class="btn-label">Generate Shopping List</span>
		</button>
	</div>
</div>

<style>
	.ribbon-modal-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.selected-recipes h3 {
		margin: 0;
		font-weight: bold;
	}

	.selected-recipes ul {
		margin: 0;
		padding-left: 1rem;
		list-style-type: disc;
		max-height: 150px;
		overflow-y: auto;
	}

	.btn-row {
		display: flex;
		gap: 1rem;
	}
</style>
