<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import LocalTime from "$lib/components/ui/local-time.svelte";

	// `now` is owned by the parent (open phase), which also decides when to swap this live countdown
	// for the snapshot-pending panel — so this component is a pure display of the remaining time.
	let {
		snapshotAt,
		videoPublishedAt,
		now
	}: { snapshotAt: string; videoPublishedAt: string; now: number } = $props();

	const target = $derived(new Date(snapshotAt).getTime());

	// Actual entry window: hours between the video going live and the snapshot cutoff.
	const windowHours = $derived(
		Math.round((target - new Date(videoPublishedAt).getTime()) / 3_600_000)
	);

	const diff = $derived(Math.max(0, target - now));
	const pad = (n: number) => n.toString().padStart(2, "0");

	const cells = $derived([
		{ value: String(Math.floor(diff / 86_400_000)), unit: "days" },
		{ value: pad(Math.floor((diff % 86_400_000) / 3_600_000)), unit: "hours" },
		{ value: pad(Math.floor((diff % 3_600_000) / 60_000)), unit: "min" },
		{ value: pad(Math.floor((diff % 60_000) / 1000)), unit: "sec" }
	]);
</script>

<Card class="px-8 py-8 text-center">
	<div class="text-base text-mut">Entries close in</div>

	<div class="my-4 flex items-start justify-center gap-3">
		{#each cells as cell, i (cell.unit)}
			{#if i > 0}
				<div class="text-5xl leading-none font-light text-line2">:</div>
			{/if}
			<div class="min-w-22 max-md:min-w-16">
				<div
					class="font-mono text-6xl leading-none font-bold tracking-tighter tabular-nums text-acc max-md:text-4xl"
				>
					{cell.value}
				</div>
				<div class="mt-2 text-xs tracking-widest text-dim uppercase">{cell.unit}</div>
			</div>
		{/each}
	</div>

	<div class="mt-1.5 font-mono text-xs text-dim">
		Snapshot at <LocalTime iso={snapshotAt} /> · {windowHours.toLocaleString()}h after publish
	</div>
</Card>
