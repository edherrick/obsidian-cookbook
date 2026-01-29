<script lang="ts">
	const {
		recipe = {},
		propsToShow = [] as string[],
		coverField = "cover",
	} = $props<{
		recipe: Record<string, any>;
		propsToShow?: string[];
		coverField?: string;
	}>();

	const visibleProps = $derived(
		propsToShow.filter(
			(key) => key in recipe && key !== "title" && key !== coverField,
		),
	) as string[];
</script>

<div class="recipe-card">
	{#if recipe[coverField]}
		<img
			class="recipe-cover"
			src={recipe[coverField]}
			alt={recipe.title || "No title"}
		/>
	{/if}

	{#if recipe.title}
		<h1 class="recipe-title">{recipe.title}</h1>
	{/if}

	<div class="recipe-body">
		{#each visibleProps as key (key)}
			{#if key in recipe && key !== coverField}
				<div class="recipe-field">
					<span class="field-name">{key}:</span>
					<span class="field-value">{recipe[key]}</span>
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.recipe-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		overflow: hidden;
		width: 200px;
		font-family: sans-serif;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.recipe-cover {
		width: 100%;
		height: 120px;
		object-fit: cover;
	}

	.recipe-title {
		font-size: 1.2rem;
		font-weight: bold;
		margin: 0.5rem;
		text-align: center;
	}

	.recipe-body {
		padding: 0.5rem;
	}

	.recipe-field {
		margin: 0.25rem 0;
		font-size: 0.85rem;
		display: flex;
		justify-content: space-between;
	}

	.field-name {
		font-weight: bold;
		color: var(--text-muted);
	}

	.field-value {
		text-align: right;
	}
</style>
