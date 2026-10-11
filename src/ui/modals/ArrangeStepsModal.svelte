<script lang="ts">
	import { obsidianIcon } from "../../utils/obsidianIcon";
	import { outOfOrder, planSteps, toPlan } from "../../session/plan";
	import type { PlanEntry, PlannedStep } from "../../session/plan";
	import type { CookSession } from "../../session/write";

	const { session, dots, save, close } = $props<{
		session: CookSession;
		dots: Map<string, string>;
		save: (plan: PlanEntry[]) => Promise<void>;
		close: () => void;
	}>();

	// svelte-ignore state_referenced_locally — the modal arranges one session
	let steps: PlannedStep[] = $state([...session.steps]);
	let expanded: Set<string> = $state(new Set());
	let dragFrom: number | null = $state(null);
	let dragOver: number | null = $state(null);
	let saving = $state(false);

	const flagged = $derived(outOfOrder(steps));

	function move(from: number, to: number) {
		if (to < 0 || to >= steps.length || from === to) return;
		const next = [...steps];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved!);
		// The first step has nothing to run alongside
		if (next[0]) next[0] = { ...next[0], meanwhile: false };
		steps = next;
	}

	function toggleMeanwhile(i: number) {
		if (i === 0) return;
		steps = steps.map((s, j) => (j === i ? { ...s, meanwhile: !s.meanwhile } : s));
	}

	function toggleExpanded(ref: string) {
		const next = new Set(expanded);
		if (next.has(ref)) next.delete(ref);
		else next.add(ref);
		expanded = next;
	}

	function reset() {
		steps = planSteps(session.recipes);
	}

	function onDragStart(e: DragEvent, i: number) {
		dragFrom = i;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
	}

	function onDragOver(e: DragEvent, i: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		dragOver = i;
	}

	function onDrop(e: DragEvent, i: number) {
		e.preventDefault();
		const from = dragFrom;
		dragFrom = null;
		dragOver = null;
		if (from !== null) move(from, i);
	}

	function onDragEnd() {
		dragFrom = null;
		dragOver = null;
	}

	async function handleSave() {
		saving = true;
		try {
			await save(toPlan(steps));
			close();
		} catch {
			// save() has already told the user; keep the modal open to retry
		} finally {
			saving = false;
		}
	}

	/** Checklist syntax reads as plain bullets in the preview. */
	function preview(text: string): string {
		return text.replace(/^\s*[-*]\s+\[.\]\s+/gm, "• ").replace(/\*\*([^*]+)\*\*/g, "$1");
	}
</script>

<div class="arrange-steps">
	<p class="hint">
		Drag steps into the order you'll cook them, or use the arrows. Mark a step
		<strong>Meanwhile</strong> to do it while the step above it runs.
	</p>

	<ol class="step-list">
		{#each steps as step, i (step.block.ref)}
			<li
				class="step-card"
				class:meanwhile={step.meanwhile}
				class:dragging={dragFrom === i}
				class:drag-over={dragOver === i && dragFrom !== i}
				draggable="true"
				ondragstart={(e) => onDragStart(e, i)}
				ondragover={(e) => onDragOver(e, i)}
				ondragleave={() => (dragOver = null)}
				ondrop={(e) => onDrop(e, i)}
				ondragend={onDragEnd}
			>
				<span class="handle" use:obsidianIcon={"grip-vertical"} aria-hidden="true"></span>
				<div class="body">
					<button class="summary-row" onclick={() => toggleExpanded(step.block.ref)}>
						<span class="dot">{dots.get(step.recipe.path) ?? ""}</span>
						<span class="title">{step.recipe.title}</span>
						<span class="meta">step {step.block.index} of {step.block.total}</span>
					</button>
					<div class="summary">{step.block.summary}</div>
					{#if flagged.has(step.block.ref)}
						<div class="warning">After step {flagged.get(step.block.ref)} of this recipe</div>
					{/if}
					{#if expanded.has(step.block.ref)}
						<div class="full">{preview(step.block.text)}</div>
					{/if}
				</div>
				<div class="controls">
					<label class="meanwhile-toggle" class:disabled={i === 0}>
						<input
							type="checkbox"
							checked={step.meanwhile}
							disabled={i === 0}
							onchange={() => toggleMeanwhile(i)}
						/>
						Meanwhile
					</label>
					<button
						class="clickable-icon"
						aria-label="Move up"
						disabled={i === 0}
						onclick={() => move(i, i - 1)}
						use:obsidianIcon={"arrow-up"}
					></button>
					<button
						class="clickable-icon"
						aria-label="Move down"
						disabled={i === steps.length - 1}
						onclick={() => move(i, i + 1)}
						use:obsidianIcon={"arrow-down"}
					></button>
				</div>
			</li>
		{/each}
	</ol>

	<div class="btn-row">
		<button class="btn" onclick={reset}>
			<span use:obsidianIcon={"rotate-ccw"} class="btn-icon"></span>
			<span class="btn-label">Reset Order</span>
		</button>
		<button class="btn" onclick={handleSave} disabled={saving}>
			<span use:obsidianIcon={"save"} class="btn-icon"></span>
			<span class="btn-label">{saving ? "Saving…" : "Save Cook Order"}</span>
		</button>
	</div>
</div>

<style>
	.arrange-steps {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.hint {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.step-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 60vh;
		overflow-y: auto;
	}

	.step-card {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-primary);
	}

	.step-card.meanwhile {
		margin-left: 2rem;
		border-style: dashed;
	}

	.step-card.dragging {
		opacity: 0.5;
	}

	.step-card.drag-over {
		border-color: var(--interactive-accent);
	}

	.handle {
		cursor: grab;
		color: var(--text-faint);
		padding-top: 2px;
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.summary-row {
		display: flex;
		align-items: baseline;
		justify-content: flex-start;
		flex-wrap: wrap;
		width: 100%;
		gap: 6px;
		padding: 0;
		height: auto;
		background: none;
		border: none;
		box-shadow: none;
		text-align: left;
		cursor: pointer;
		color: var(--text-normal);
	}

	.title {
		font-weight: 600;
		font-size: var(--font-ui-small);
	}

	.meta {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		white-space: nowrap;
	}

	.summary {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.warning {
		font-size: var(--font-ui-smaller);
		color: var(--text-warning);
	}

	.full {
		margin-top: 4px;
		white-space: pre-wrap;
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.meanwhile-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-right: 4px;
		white-space: nowrap;
	}

	.meanwhile-toggle.disabled {
		opacity: 0.4;
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
