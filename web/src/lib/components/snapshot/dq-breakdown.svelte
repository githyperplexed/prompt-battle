<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { DqEntry } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";
	import { dqLabel } from "$lib/utilities/labels";

	let {
		dq,
		selectedReason = null,
		onSelect
	}: {
		dq: DqEntry[];
		selectedReason?: string | null;
		onSelect?: (reason: string) => void;
	} = $props();

	const max = $derived(Math.max(1, ...dq.map((d) => d.count)));
</script>

<Card>
	<h3 class="m-0 mb-3 text-lg font-semibold">Disqualifications</h3>

	{#each dq as d (d.reason)}
		<button
			type="button"
			class={cn(
				"dq-row mb-2.5 w-full items-center gap-3 rounded-control bg-card2/60 px-3 py-2.5 text-left transition-colors hover:bg-card2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
				selectedReason === d.reason && "bg-bad/10"
			)}
			onclick={() => onSelect?.(d.reason)}
			aria-pressed={selectedReason === d.reason}
		>
			<div class="font-mono text-xs text-mut">{dqLabel(d.reason)}</div>
			<div class="h-2 overflow-hidden rounded-sm bg-card2">
				<div
					class="h-full rounded-sm bg-bad"
					style={`width:${((d.count / max) * 100).toFixed(1)}%`}
				></div>
			</div>
			<div class="text-right text-sm tabular-nums text-mut">{d.count.toLocaleString()}</div>
		</button>
	{/each}
</Card>

<style>
	.dq-row {
		display: grid;
		grid-template-columns: 155px 1fr 50px;
	}

	@media (max-width: 767px) {
		.dq-row {
			grid-template-columns: 108px 1fr 42px;
		}
	}
</style>
