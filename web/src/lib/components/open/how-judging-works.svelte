<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import JudgeChip from "$lib/components/ui/judge-chip.svelte";

	let { panel }: { panel: string[] } = $props();
</script>

<Card>
	<h3 class="m-0 mb-3 text-lg font-semibold">How judging works</h3>
	<p class="m-0 mb-2.5 text-base leading-relaxed text-mut text-pretty">
		Three independent AI judges, each a different provider, score every eligible entry on four
		dimensions: persuasiveness, originality, cleverness, execution.
	</p>

	<div class="my-2 mb-3.5 flex flex-wrap gap-2">
		{#each panel as model, i (model)}
			<JudgeChip index={i} {model} />
		{/each}
	</div>

	<p class="m-0 text-base leading-relaxed text-mut text-pretty">
		The top 64 advance to a seeded single-elimination bracket (64 → 1 over 6 rounds) that resolves
		to one winner.
	</p>
</Card>
