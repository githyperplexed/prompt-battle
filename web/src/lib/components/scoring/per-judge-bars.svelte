<script lang="ts">
	import { judgeBg, judgeLabel, judgeText } from "$lib/utilities/judges";

	let { perModel, eligible }: { perModel: { id: string; done: number }[]; eligible: number } =
		$props();

	const rows = $derived(
		perModel.map((model, i) => ({
			id: model.id,
			label: judgeLabel(i),
			text: judgeText(i),
			bg: judgeBg(i),
			pct: eligible > 0 ? Math.min(100, Math.round((model.done / eligible) * 100)) : 0
		}))
	);
</script>

<div class="mt-1 flex w-full max-w-[480px] flex-col gap-3">
	{#each rows as row (row.id)}
		<div class="grid grid-cols-[118px_1fr_46px] items-center gap-3">
			<div class={`text-sm font-medium ${row.text}`}>{row.label}</div>
			<div class="h-2 overflow-hidden rounded-sm bg-card2">
				<div class={`h-full rounded-sm ${row.bg}`} style={`width:${row.pct}%`}></div>
			</div>
			<div class="text-right text-xs tabular-nums text-mut">{row.pct}%</div>
		</div>
	{/each}
</div>
