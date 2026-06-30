<script lang="ts">
	import LeaderboardRow from "$lib/components/scored/leaderboard-row.svelte";
	import type { LeaderboardData } from "$lib/types/contest";

	let { data }: { data: LeaderboardData } = $props();

	let query = $state("");
	let applied = $state("");
	let expandedId = $state<string | null>(null);

	// Debounce the filter so a large list isn't re-diffed on every keystroke.
	$effect(() => {
		const next = query;
		const timer = setTimeout(() => (applied = next), 150);

		return () => clearTimeout(timer);
	});

	const filtered = $derived.by(() => {
		const q = applied.trim().toLowerCase();
		if (!q) return data.rows;

		return data.rows.filter(
			(r) => r.author.toLowerCase().includes(q) || r.channelId.toLowerCase().includes(q)
		);
	});

	const toggle = (id: string) => {
		expandedId = expandedId === id ? null : id;
	};
</script>

<div class="flex flex-col gap-3">
	<h3 class="m-0 text-lg font-semibold">Leaderboard</h3>

	<input
		class="w-full rounded-control border border-line bg-bg2 px-3.5 py-2.5 text-sm text-tx outline-none focus:border-acc"
		placeholder="Find your entry by author or channel id…"
		bind:value={query}
	/>

	<div class="overflow-hidden rounded-card border border-line bg-card">
		<div
			class="lb-cols gap-2.5 border-b border-line px-5 py-3 text-xs tracking-widest text-dim uppercase"
		>
			<div>#</div>
			<div>Entry</div>
			<div class="text-right">Score</div>
		</div>

		{#if filtered.length === 0}
			<div class="py-9 text-center text-sm text-dim">No entries match “{applied}”.</div>
		{:else}
			{#each filtered as row (row.id)}
				<LeaderboardRow
					{row}
					cutRank={data.cutRank}
					expanded={expandedId === row.id}
					onToggle={() => toggle(row.id)}
				/>
			{/each}
		{/if}
	</div>
</div>

<style>
	.lb-cols {
		display: grid;
		grid-template-columns: 56px 1fr 92px;
	}
</style>
