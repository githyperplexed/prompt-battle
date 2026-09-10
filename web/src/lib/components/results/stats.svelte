<script lang="ts">
	import type { ContestMeta, Stats } from "$lib/types/results";
	import { formatUtc } from "$lib/utilities/format";

	let { stats, meta }: { stats: Stats; meta: ContestMeta } = $props();

	const cells = $derived([
		{ label: "Captured", value: stats.captured },
		{ label: "Eligible", value: stats.eligible },
		{ label: "Disqualified", value: stats.disqualified },
		{ label: "In the bracket", value: stats.seeded }
	]);
</script>

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">The field</p>

	<div class="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
		{#each cells as cell (cell.label)}
			<div class="bg-bg px-5 py-6">
				<div class="font-mono text-4xl font-bold tracking-tight tabular-nums">{cell.value}</div>
				<div class="mt-2 text-xs tracking-widest text-mut uppercase">{cell.label}</div>
			</div>
		{/each}
	</div>

	<dl class="mt-6 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
		<dt class="text-dim">Video published</dt>
		<dd class="m-0 font-mono text-xs text-mut">{formatUtc(meta.videoPublishedAt)}</dd>
		<dt class="text-dim">Entries frozen</dt>
		<dd class="m-0 font-mono text-xs text-mut">{formatUtc(meta.snapshotAt)}</dd>
		<dt class="text-dim">Results published</dt>
		<dd class="m-0 font-mono text-xs text-mut">{formatUtc(meta.resultsPublishedAt)}</dd>
		<dt class="text-dim">Judges</dt>
		<dd class="m-0 font-mono text-xs text-mut">
			{meta.panel.map((judge) => judge.slug).join(" · ")}
		</dd>
	</dl>
</section>
