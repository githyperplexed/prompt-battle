<script lang="ts">
	import { cn } from "$lib/utilities/cn";

	let { total, eligible, disqualified }: { total: number; eligible: number; disqualified: number } =
		$props();

	const kpis = $derived([
		{ value: total, label: "captured", tone: "" },
		{ value: eligible, label: "eligible", tone: "text-ok" },
		{ value: disqualified, label: "disqualified", tone: "text-bad" }
	]);
</script>

<div class="flex gap-3.5 max-md:flex-col">
	{#each kpis as kpi (kpi.label)}
		<div class="flex-1 rounded-card border border-line bg-card p-5">
			<div class={cn("font-mono text-4xl font-bold tracking-tight tabular-nums", kpi.tone)}>
				{kpi.value.toLocaleString()}
			</div>
			<div class="mt-1 text-sm tracking-widest text-dim uppercase">{kpi.label}</div>
		</div>
	{/each}
</div>
