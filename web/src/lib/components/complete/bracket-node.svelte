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
		"flex w-full flex-col gap-1 rounded-control border bg-bg2 p-[7px] text-left hover:border-line2",
		selected
			? "border-acc shadow-[0_0_0_2px_color-mix(in_oklch,var(--color-acc),transparent_78%)]"
			: "border-line"
	)}
>
	{#each teams as team (team.key)}
		<div
			class={cn(
				"flex items-center gap-2 rounded-[5px] px-1 py-[3px] text-xs",
				team.win ? "bg-white/[0.04] font-semibold text-tx" : "text-dim"
			)}
		>
			<span
				class={cn("min-w-5 text-right font-mono text-[11px]", team.win ? "text-acc" : "text-dim")}
			>
				{team.entrant?.seed ?? "—"}
			</span>
			<span class="overflow-hidden text-ellipsis whitespace-nowrap">
				{team.entrant?.name ?? "bye"}
			</span>
		</div>
	{/each}
</button>
