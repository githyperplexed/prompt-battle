<script lang="ts">
	import JudgeChip from "$lib/components/ui/judge-chip.svelte";
	import { judgeBg } from "$lib/utilities/judges";

	let { perModel, eligible }: { perModel: { id: string; done: number }[]; eligible: number } =
		$props();

	const pct = (done: number) =>
		eligible > 0 ? Math.min(100, Math.round((done / eligible) * 100)) : 0;
</script>

<div class="flex w-full flex-col">
	{#each perModel as model, i (model.id)}
		{@const p = pct(model.done)}
		<div class="flex flex-col gap-2 py-3 not-first:border-t not-first:border-line first:pt-0 last:pb-0">
			<div class="h-2 overflow-hidden rounded-sm bg-card2">
				<div class={`h-full rounded-sm ${judgeBg(i)}`} style={`width:${p}%`}></div>
			</div>
			<div class="flex items-center justify-between gap-3">
				<JudgeChip index={i} model={model.id} />
				<span class="flex-none font-mono text-xs tabular-nums text-mut">{p}%</span>
			</div>
		</div>
	{/each}
</div>
