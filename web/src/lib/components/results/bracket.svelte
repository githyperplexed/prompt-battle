<script lang="ts">
	import type { BracketMatchup, BracketRound } from "$lib/types/results";
	import { cn } from "$lib/utilities/cn";

	let { rounds }: { rounds: BracketRound[] } = $props();

	// The tree view starts at the round of 16 so the bracket reads at a glance; the wider early
	// rounds are listed below it.
	const TREE_MAX_MATCHUPS = 8;
	const tree = $derived(rounds.filter((round) => round.matchups.length <= TREE_MAX_MATCHUPS));
	const early = $derived(rounds.filter((round) => round.matchups.length > TREE_MAX_MATCHUPS));

	const pickLabel = (m: BracketMatchup, pick: "a" | "b" | "split") =>
		pick === "split" ? "split" : m[pick].author;
</script>

{#snippet entrant(m: BracketMatchup, side: "a" | "b")}
	{@const e = m[side]}
	<div
		class={cn(
			"flex min-w-0 items-baseline gap-2 text-sm",
			m.winner === side ? "text-fg" : "text-dim"
		)}
	>
		<span class="w-5 flex-none font-mono text-[11px] text-dim tabular-nums">{e.seed}</span>
		<span class={cn("min-w-0 truncate", m.winner === side && "font-medium")}>{e.author}</span>
	</div>
{/snippet}

{#snippet matchup(m: BracketMatchup)}
	<details class="group border border-line bg-bg">
		<summary class="flex flex-col gap-1 px-3 py-2.5">
			{@render entrant(m, "a")}
			{@render entrant(m, "b")}
		</summary>
		<div class="border-t border-line px-3 py-2.5">
			<ul class="m-0 list-none p-0">
				{#each m.votes as vote (vote.judge)}
					<li class="flex items-baseline justify-between gap-3 font-mono text-[11px]">
						<span class="text-dim">{vote.judge}</span>
						<span class={cn("truncate", vote.pick === "split" ? "text-dim italic" : "text-mut")}>
							{pickLabel(m, vote.pick)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</details>
{/snippet}

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">The bracket</p>
	<h2 class="mt-3 mb-2 text-2xl font-semibold tracking-tight">
		Single elimination, seeded by score
	</h2>
	<p class="m-0 mb-8 max-w-2xl text-sm leading-relaxed text-mut">
		Each matchup was judged by all three models, twice each with the order swapped. A judge's vote
		only counted if it picked the same entry both ways; the majority won, and a deadlock went to the
		higher seed. Open any matchup to see the votes.
	</p>

	<div class="overflow-x-auto">
		<div
			class="grid min-w-[720px] gap-4"
			style:grid-template-columns={`repeat(${tree.length}, 1fr)`}
		>
			{#each tree as round (round.round)}
				<div class="flex flex-col">
					<div class="mb-3 font-mono text-[11px] tracking-widest text-dim uppercase">
						{round.label}
					</div>
					<div class="flex flex-1 flex-col justify-around gap-3">
						{#each round.matchups as m (m.slot)}
							{@render matchup(m)}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#each early as round (round.round)}
		<details class="group mt-4 border border-line">
			<summary class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
				<span>{round.label} · {round.matchups.length} matchups</span>
				<span class="font-mono text-xs text-dim group-open:hidden">show</span>
				<span class="hidden font-mono text-xs text-dim group-open:inline">hide</span>
			</summary>
			<div class="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each round.matchups as m (m.slot)}
					{@render matchup(m)}
				{/each}
			</div>
		</details>
	{/each}
</section>
