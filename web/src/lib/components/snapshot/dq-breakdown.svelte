<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { DqEntry } from "$lib/types/contest";
	import { dqLabel } from "$lib/utilities/labels";

	let { dq }: { dq: DqEntry[] } = $props();

	const max = $derived(Math.max(1, ...dq.map((d) => d.count)));
</script>

<Card>
	<h3 class="m-0 mb-3 text-[17px] font-semibold">Disqualifications</h3>

	{#each dq as d (d.reason)}
		<div
			class="mb-2.5 grid grid-cols-[155px_1fr_50px] items-center gap-3 max-[760px]:grid-cols-[108px_1fr_42px]"
		>
			<div class="font-mono text-xs text-mut">{dqLabel(d.reason)}</div>
			<div class="h-[9px] overflow-hidden rounded-[5px] bg-card2">
				<div
					class="h-full rounded-[5px] bg-gradient-to-r from-accd to-acc"
					style={`width:${((d.count / max) * 100).toFixed(1)}%`}
				></div>
			</div>
			<div class="text-right text-[13px] tabular-nums text-mut">{d.count.toLocaleString()}</div>
		</div>
	{/each}
</Card>
