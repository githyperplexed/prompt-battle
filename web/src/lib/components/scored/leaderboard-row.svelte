<script lang="ts">
	import LocalTime from "$lib/components/ui/local-time.svelte";
	import type { LeaderboardRow } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";
	import { hasTextSelection } from "$lib/utilities/dom";
	import { judgeText } from "$lib/utilities/judges";

	let {
		row,
		expanded,
		cutRank,
		onToggle
	}: {
		row: LeaderboardRow;
		expanded: boolean;
		cutRank: number;
		onToggle: () => void;
	} = $props();

	const PREVIEW = 100;
	const long = $derived(row.text.length > PREVIEW);

	const handleClick = () => {
		// Don't toggle when the click is the end of a text selection drag.
		if (!long || hasTextSelection()) return;
		onToggle();
	};
</script>

<div class="lb-entry border-t border-line first:border-t-0">
	<button
		type="button"
		class={cn(
			"w-full cursor-text text-left transition-colors select-text hover:bg-card2",
			long && "cursor-pointer"
		)}
		onclick={handleClick}
	>
		<div class="lb-cols items-start gap-2.5 px-5 py-3">
			<div class={`font-semibold tabular-nums ${row.advancing ? "text-tx" : "text-dim"}`}>
				{row.rank}
			</div>
			<div class="min-w-0">
				<span class="block font-medium">{row.author}</span>
				<span class="font-mono text-xs text-dim"><LocalTime iso={row.submittedAt} /></span>
				<p class="mt-1.5 text-sm leading-relaxed text-mut text-pretty">
					{expanded || !long ? row.text : `${row.text.slice(0, PREVIEW)}…`}
				</p>
				{#if long}
					<span class="font-mono text-xs text-mut">{expanded ? "Show less" : "Show more"}</span>
				{/if}
				{#if row.perModel.length > 0}
					<div class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
						{#each row.perModel as pm, i (pm.model)}
							<span>
								<span class={judgeText(i)}>{pm.model}</span>
								<span class="text-mut tabular-nums">{pm.total}</span>
							</span>
						{/each}
					</div>
				{/if}
			</div>
			<div class="text-right">
				<span class="font-mono text-lg font-bold tabular-nums">{row.score.toFixed(1)}</span>
			</div>
		</div>
	</button>

	{#if row.rank === cutRank}
		<div
			class="flex items-center justify-center border-y-2 border-dashed border-acc bg-acc/10 py-2"
		>
			<span
				class="rounded-chip bg-bg px-3 py-1 font-mono text-xs font-semibold tracking-widest text-acc uppercase"
			>
				Top 64 cut line · seeds above advance
			</span>
		</div>
	{/if}
</div>

<style>
	.lb-cols {
		display: grid;
		grid-template-columns: 56px 1fr 92px;
	}

	/* Skip layout/paint for off-screen rows so a multi-thousand-row list stays smooth. */
	.lb-entry {
		content-visibility: auto;
		contain-intrinsic-size: auto 96px;
	}
</style>
