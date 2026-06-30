<script lang="ts">
	import LocalTime from "$lib/components/ui/local-time.svelte";
	import type { LeaderboardRow } from "$lib/types/contest";

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
</script>

<div class="lb-entry border-t border-line first:border-t-0">
	<button
		type="button"
		class="w-full text-left transition-colors hover:bg-card2"
		onclick={() => long && onToggle()}
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
					<span class="font-mono text-xs text-acc">{expanded ? "Show less" : "Show more"}</span>
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
