<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import { formatUtc } from "$lib/utilities/format";

	let { snapshotAt }: { snapshotAt: string } = $props();

	const target = $derived(new Date(snapshotAt).getTime());
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 1000);

		return () => clearInterval(timer);
	});

	const diff = $derived(Math.max(0, target - now));
	const closed = $derived(diff <= 0);
	const pad = (n: number) => n.toString().padStart(2, "0");

	const cells = $derived([
		{ value: String(Math.floor(diff / 86_400_000)), unit: "days" },
		{ value: pad(Math.floor((diff % 86_400_000) / 3_600_000)), unit: "hours" },
		{ value: pad(Math.floor((diff % 3_600_000) / 60_000)), unit: "min" },
		{ value: pad(Math.floor((diff % 60_000) / 1000)), unit: "sec" }
	]);
</script>

<Card class="px-8 py-8 text-center">
	<div class="text-[15px] text-mut">Entries close in</div>

	{#if closed}
		<div class="my-4 text-[34px] font-bold text-acc">Entries closed — snapshot pending</div>
	{:else}
		<div class="my-4 flex items-start justify-center gap-3">
			{#each cells as cell, i (cell.unit)}
				{#if i > 0}
					<div class="text-[46px] leading-[1.1] font-light text-line2">:</div>
				{/if}
				<div class="min-w-[88px] max-[760px]:min-w-[64px]">
					<div
						class="font-mono text-[66px] leading-none font-bold tracking-[-0.04em] tabular-nums text-acc max-[760px]:text-[42px]"
					>
						{cell.value}
					</div>
					<div class="mt-[7px] text-xs tracking-[0.12em] text-dim uppercase">{cell.unit}</div>
				</div>
			{/each}
		</div>
	{/if}

	<div class="mt-1.5 font-mono text-xs text-dim">
		Snapshot at {formatUtc(snapshotAt)} · 168h after publish
	</div>
</Card>
