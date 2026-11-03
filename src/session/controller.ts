import { Notice } from "obsidian";
import type { TFile } from "obsidian";
import { get } from "svelte/store";
import type CookbookPlugin from "../main";
import { applySetCookSoon } from "../recipes/repository";
import { loadCookSession, prepareCookSession, writeCookSessionNote } from "./write";
import type { CookSession } from "./write";
import { recipeDots } from "./build";
import { toPlan } from "./plan";
import type { PlanEntry } from "./plan";
import { SvelteModalWrapper } from "../utils/SvelteModalWrapper";
import ArrangeStepsModal from "../ui/modals/ArrangeStepsModal.svelte";

/** Writes cook session notes and opens the step-arranging modal. */
export class CookSessionController {
	constructor(private readonly plugin: CookbookPlugin) {}

	/**
	 * Write today's session note for the cook-together recipes and open it.
	 * Optionally marks them cook-soon too, so the shopping list follows.
	 */
	async create(markCookSoon: boolean): Promise<void> {
		const { app, settings, recipeStores } = this.plugin;
		await this.plugin.refreshRecipes();
		const recipes = get(recipeStores.cookTogetherRecipes);
		if (recipes.length === 0) {
			new Notice("No recipes are marked cook together.");
			return;
		}
		if (markCookSoon) {
			applySetCookSoon(
				recipeStores.recipes,
				recipes.map((r) => r.path),
				app,
				settings.cookSoonProp,
			);
		}
		try {
			const session = await prepareCookSession(app, recipes, {
				folder: settings.cookSessionFolder,
				cache: this.plugin.ingredientCache,
			});
			const file = await this.save(session, toPlan(session.steps));
			await app.workspace.getLeaf("tab").openFile(file);
			this.openArrangeModal(session);
		} catch (e) {
			console.error("cookbook: failed to write cook session", e);
			new Notice("Could not write the cook session note. See the console for details.");
		}
	}

	/** Reopen a session note's recipes and cook order for arranging. */
	async arrange(file: TFile): Promise<void> {
		await this.plugin.refreshRecipes();
		const recipes = get(this.plugin.recipeStores.recipes);
		const session = await loadCookSession(this.plugin.app, file, {
			cache: this.plugin.ingredientCache,
			findRecipe: (path) => recipes.find((r) => r.path === path),
		});
		if (!session) {
			new Notice("This cook session doesn't link any recipes that still exist.");
			return;
		}
		this.openArrangeModal(session);
	}

	isCookSession(file: TFile): boolean {
		const tags: unknown = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.tags;
		const list = Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [];
		return list.some((t) => String(t).replace(/^#/, "") === "cook-session");
	}

	private save(session: CookSession, plan: PlanEntry[]): Promise<TFile> {
		return writeCookSessionNote(this.plugin.app, session, plan, {
			vocab: this.plugin.vocabulary,
			unitPrefs: this.plugin.unitPrefs(),
		});
	}

	private openArrangeModal(session: CookSession): void {
		new SvelteModalWrapper(this.plugin.app, ArrangeStepsModal, {
			session,
			dots: recipeDots(session.recipes),
			save: async (plan: PlanEntry[]) => {
				try {
					await this.save(session, plan);
				} catch (e) {
					console.error("cookbook: failed to save cook order", e);
					new Notice("Could not save the cook order. See the console for details.");
					throw e;
				}
			},
		}).open();
	}
}
