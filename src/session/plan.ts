import type { SessionRecipe } from "./build";
import { cookOrder, splitStepBlocks } from "./steps";
import type { StepBlock } from "./steps";

/**
 * A hand-arranged cook order: every step block of the session's recipes, in
 * the order they will be cooked. A "meanwhile" step is done while the main
 * step before it runs (a bake, a simmer, a soak).
 */
export interface PlanEntry {
	ref: string;
	meanwhile: boolean;
}

export interface PlannedStep {
	block: StepBlock;
	recipe: SessionRecipe;
	meanwhile: boolean;
}

const MEANWHILE_PREFIX = "meanwhile ";

/** Every step, recipe by recipe in cook order: the order before any arranging. */
export function defaultPlan(recipes: SessionRecipe[]): PlanEntry[] {
	return cookOrder(recipes).flatMap((r) =>
		splitStepBlocks(r).map((b) => ({ ref: b.ref, meanwhile: false })),
	);
}

/**
 * Line a saved plan up with the recipes as they are now. Steps keep their
 * saved place; steps whose recipe or block is gone are dropped; steps the
 * plan has never seen (a new recipe, an added block) go at the end in default
 * order. A meanwhile step with nothing before it becomes a main step.
 */
export function planSteps(recipes: SessionRecipe[], saved?: PlanEntry[]): PlannedStep[] {
	const byRef = new Map<string, { block: StepBlock; recipe: SessionRecipe }>();
	for (const recipe of recipes) {
		for (const block of splitStepBlocks(recipe)) byRef.set(block.ref, { block, recipe });
	}

	const out: PlannedStep[] = [];
	const used = new Set<string>();
	for (const entry of [...(saved ?? []), ...defaultPlan(recipes)]) {
		const found = byRef.get(entry.ref);
		if (!found || used.has(entry.ref)) continue;
		used.add(entry.ref);
		out.push({ ...found, meanwhile: entry.meanwhile && out.length > 0 });
	}
	return out;
}

export function toPlan(steps: PlannedStep[]): PlanEntry[] {
	return steps.map((s) => ({ ref: s.block.ref, meanwhile: s.meanwhile }));
}

/** Frontmatter form: `recipes/X.md#2`, or `meanwhile recipes/X.md#2`. */
export function serializePlan(plan: PlanEntry[]): string[] {
	return plan.map((e) => (e.meanwhile ? `${MEANWHILE_PREFIX}${e.ref}` : e.ref));
}

export function parsePlan(value: unknown): PlanEntry[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const plan: PlanEntry[] = [];
	for (const raw of value) {
		if (typeof raw !== "string" || !raw.trim()) continue;
		const s = raw.trim();
		const meanwhile = s.startsWith(MEANWHILE_PREFIX);
		plan.push({ ref: meanwhile ? s.slice(MEANWHILE_PREFIX.length).trim() : s, meanwhile });
	}
	return plan;
}

/**
 * Steps placed before an earlier step of their own recipe, mapped to the
 * step they jumped ahead of. Allowed (the cook may know better), but flagged.
 */
export function outOfOrder(steps: PlannedStep[]): Map<string, number> {
	const latest = new Map<string, number>();
	const flagged = new Map<string, number>();
	for (const { block } of steps) {
		const seen = latest.get(block.recipePath) ?? 0;
		if (block.index < seen) flagged.set(block.ref, seen);
		else latest.set(block.recipePath, block.index);
	}
	return flagged;
}
