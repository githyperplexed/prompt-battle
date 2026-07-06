<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";

	const steps = [
		"Comment once on the video.",
		"Include all 3 hidden keywords (revealed in the video).",
		"Keep it 50–3,000 characters.",
		"No links.",
		"One entry per channel."
	];
</script>

<Card>
	<h3 class="m-0 mb-3 text-lg font-semibold">How to enter</h3>
	<ul class="m-0 flex list-none flex-col gap-3 p-0">
		{#each steps as step, i (step)}
			<li class="flex items-center gap-3 text-base">
				<span
					class="flex size-6 flex-none items-center justify-center rounded-control border border-line bg-card2 font-mono text-xs text-mut"
				>
					{i + 1}
				</span>
				{step}
			</li>
		{/each}
	</ul>
</Card>
