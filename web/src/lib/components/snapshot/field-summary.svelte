<script lang="ts">
	import type { EntryStatus } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";

	let {
		total,
		eligible,
		disqualified,
		selectedStatus = null,
		onSelect
	}: {
		total: number;
		eligible: number;
		disqualified: number;
		selectedStatus?: EntryStatus | null;
		onSelect?: (status: EntryStatus | null) => void;
	} = $props();

	const kpis = $derived([
		{ value: total, label: "captured", tone: "", status: null, selectedBg: "" },
		{
			value: eligible,
			label: "eligible",
			tone: "text-ok",
			status: "eligible" as const,
			selectedBg: "bg-ok/10"
		},
		{
			value: disqualified,
			label: "disqualified",
			tone: "text-bad",
			status: "disqualified" as const,
			selectedBg: "bg-bad/10"
		}
	]);
</script>

<div class="flex gap-3.5 max-md:flex-col">
	{#each kpis as kpi (kpi.label)}
		{@const selected = kpi.status !== null && selectedStatus === kpi.status}
		<button
			type="button"
			class={cn(
				"flex-1 rounded-card border border-line bg-card p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tx",
				onSelect ? "cursor-pointer" : "cursor-default",
				onSelect && !selected && "hover:bg-card2",
				selected && kpi.selectedBg
			)}
			disabled={!onSelect}
			onclick={() => onSelect?.(kpi.status)}
			aria-pressed={selected}
		>
			<div class={cn("font-mono text-4xl font-bold tracking-tight tabular-nums", kpi.tone)}>
				{kpi.value.toLocaleString()}
			</div>
			<div class="mt-1 text-sm tracking-widest text-dim uppercase">{kpi.label}</div>
		</button>
	{/each}
</div>
