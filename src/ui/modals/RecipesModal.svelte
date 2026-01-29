<script lang="ts">
	import RecipeCard from "../components/RecipeCard.svelte";

	const { recipes, propsToShow } = $props<{
		recipes?: {}[];
		propsToShow?: string[];
	}>();
</script>

<div class="recipe-grid">
	{#each recipes as recipe (recipe.path)}
		<RecipeCard {recipe} {propsToShow} />
	{/each}
</div>

<style>
	.recipe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
	}
</style>
