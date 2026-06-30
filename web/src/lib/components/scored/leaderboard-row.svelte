<script lang="ts">
	import ScoreMatrix from "$lib/components/scored/score-matrix.svelte";
	import type { EntryDetail, LeaderboardRow } from "$lib/types/contest";

	let {
		row,
		contestId,
		expanded,
		cutRank,
		onToggle
	}: {
		row: LeaderboardRow;
		contestId: string;
		expanded: boolean;
		cutRank: number;
		onToggle: () => void;
	} = $props();

	let detail = $state<EntryDetail | null>(null);

	// Lazy-load the comment + score matrix the first time the row is expanded.
	$effect(() => {
		if (!expanded || detail) return;

		const params = new URLSearchParams({ contest: contestId, entry: row.id });

		fetch(`/api/entry-detail?${params}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				detail = data;
			});
	});
</script>

<div class="border-t border-line first:border-t-0">
	<button
		type="button"
		class="lb-cols w-full items-center gap-2.5 px-5 py-3 text-left transition-colors hover:bg-card2"
		onclick={onToggle}
	>
		<div class={`font-semibold tabular-nums ${row.advancing ? "text-tx" : "text-dim"}`}>
			{row.rank}
		</div>
		<div>
			<span class="block font-medium">{row.author}</span>
			<span class="font-mono text-xs text-dim">{row.channelId}</span>
		</div>
		<div class="text-right">
			<span class="font-mono text-lg font-bold tabular-nums">{row.score.toFixed(1)}</span>
		</div>
		<div class="text-right">
			{#if row.advancing}
				<span
					class="rounded-full border border-acc/40 bg-acc/20 px-2.5 py-1 font-mono text-xs font-bold text-acc"
				>
					#{row.seed}
				</span>
			{:else}
				<span class="rounded-full border border-line px-2 py-1 font-mono text-xs text-dim">
					out
				</span>
			{/if}
		</div>
	</button>

	{#if row.rank === cutRank}
		<div
			class="flex items-center justify-center border-y-2 border-dashed border-acc bg-acc/10 py-2"
		>
			<span
				class="rounded-chip bg-bg px-3 py-1 font-mono text-xs font-semibold tracking-widest text-acc uppercase"
			>
				Top 64 cut line — seeds above advance
			</span>
		</div>
	{/if}

	{#if expanded}
		<div class="border-t border-line bg-bg2 p-5">
			{#if detail}
				<p class="mb-4 text-base leading-relaxed text-tx text-pretty">{detail.comment}</p>
				<ScoreMatrix matrix={detail.matrix} score={detail.score} />
			{:else}
				<div class="text-sm text-dim">Loading…</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.lb-cols {
		display: grid;
		grid-template-columns: 56px 1fr 92px 78px;
	}
</style>
