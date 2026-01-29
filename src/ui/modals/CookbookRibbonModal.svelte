<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";

	const { openRecipeModal, generateShoppingList } = $props<{
		openRecipeModal: () => void;
		generateShoppingList: () => void;
	}>();
</script>

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
