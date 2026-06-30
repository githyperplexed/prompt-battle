<script lang="ts">
	import { cn } from "$lib/utilities/cn";
	import type { BracketMatchup } from "$lib/types/contest";

	let {
		matchup,
		selected,
		onSelect
	}: { matchup: BracketMatchup; selected: boolean; onSelect: () => void } = $props();

	const teams = $derived([
		{ key: "a", entrant: matchup.a, win: matchup.winnerSide === "a" },
		{ key: "b", entrant: matchup.b, win: matchup.winnerSide === "b" }
	]);
</script>

<button
	type="button"
	data-mid={matchup.id}
	onclick={onSelect}
	class={cn(
		"flex w-full flex-col gap-1 rounded-control border bg-bg2 p-2 text-left",
		selected ? "border-acc ring-2 ring-acc/20" : "border-line hover:border-line2"
	)}
>
	{#each teams as team (team.key)}
		<div
			class={cn(
				"flex items-center gap-2 rounded-sm px-1 py-1 text-xs",
				team.win ? "bg-white/[0.04] font-semibold text-tx" : "text-dim"
			)}
		>
			<span
				class={cn("min-w-5 text-right font-mono text-xs", team.win ? "text-acc" : "text-dim")}
			>
				{team.entrant?.seed ?? "–"}
			</span>
			<span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
				{team.entrant?.name ?? "bye"}
			</span>
		</div>
	{/each}
</button>
