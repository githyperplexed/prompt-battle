<script lang="ts">
	import { page } from "$app/state";

	import LeaderboardRow from "$lib/components/scored/leaderboard-row.svelte";
	import { cn } from "$lib/utilities/cn";
	import type { LeaderboardData } from "$lib/types/contest";

	let { data, contestId }: { data: LeaderboardData; contestId: string } = $props();

	let expandedId = $state<string | null>(null);

	const toggle = (id: string) => {
		expandedId = expandedId === id ? null : id;
	};

	// Build a link that keeps existing query params (so the dev ?phase= override survives).
	const linkTo = (params: Record<string, string>) => {
		const next = new URLSearchParams(page.url.search);

		for (const [key, value] of Object.entries(params)) next.set(key, value);

		return `?${next}`;
	};

	const firstRank = $derived(data.rows.at(0)?.rank ?? 0);
	const lastRank = $derived(data.rows.at(-1)?.rank ?? 0);
	const hasPrev = $derived(data.mode === "top" && data.page > 0);
	const hasNext = $derived(
		data.mode === "top" && data.page * data.pageSize + data.rows.length < data.totalEligible
	);

	const tab = "rounded-control border px-3 py-2 text-sm";
</script>

<div class="flex flex-wrap items-center justify-between gap-2.5">
	<h3 class="m-0 text-lg font-semibold">
		Leaderboard <span class="text-sm text-dim">· top 64 advance to the bracket</span>
	</h3>
	<div class="flex gap-1.5">
		<a
			class={cn(
				tab,
				data.mode === "top" ? "border-line2 bg-card2 text-tx" : "border-line bg-card text-mut"
			)}
			href={linkTo({ view: "top", page: "0" })}
			data-sveltekit-noscroll
		>
			Top results
		</a>
		<a
			class={cn(
				tab,
				data.mode === "cut" ? "border-line2 bg-card2 text-tx" : "border-line bg-card text-mut"
			)}
			href={linkTo({ view: "cut" })}
			data-sveltekit-noscroll
		>
			The cut line
		</a>
	</div>
</div>

<div class="overflow-hidden rounded-card border border-line bg-card">
	<div
		class="grid grid-cols-[56px_1fr_92px_78px] gap-2.5 border-b border-line px-5 py-3 text-xs tracking-widest text-dim uppercase"
	>
		<div>#</div>
		<div>Entry</div>
		<div class="text-right">Score</div>
		<div class="text-right">Seed</div>
	</div>

	{#each data.rows as row (row.id)}
		<LeaderboardRow
			{row}
			{contestId}
			cutRank={data.cutRank}
			expanded={expandedId === row.id}
			onToggle={() => toggle(row.id)}
		/>
	{/each}

	<div class="flex items-center justify-between gap-2.5 border-t border-line px-5 py-3">
		{#if hasPrev}
			<a
				class="rounded-control border border-line bg-card2 px-3 py-1.5 text-sm text-mut"
				href={linkTo({ view: "top", page: String(data.page - 1) })}
				data-sveltekit-noscroll>‹ Prev</a
			>
		{:else}
			<span
				class="rounded-control border border-line bg-card2 px-3 py-1.5 text-sm text-mut opacity-40"
				>‹ Prev</span
			>
		{/if}

		<span class="font-mono text-xs text-dim">
			Showing ranks {firstRank}–{lastRank} of {data.totalEligible.toLocaleString()} eligible
		</span>

		{#if hasNext}
			<a
				class="rounded-control border border-line bg-card2 px-3 py-1.5 text-sm text-mut"
				href={linkTo({ view: "top", page: String(data.page + 1) })}
				data-sveltekit-noscroll>Next ›</a
			>
		{:else}
			<span
				class="rounded-control border border-line bg-card2 px-3 py-1.5 text-sm text-mut opacity-40"
				>Next ›</span
			>
		{/if}
	</div>
</div>
