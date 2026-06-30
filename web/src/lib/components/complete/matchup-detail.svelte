<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { MatchupDetail } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";
	import { judgeText } from "$lib/utilities/judges";

	let { detail }: { detail: MatchupDetail | null } = $props();

	const entrants = $derived(
		detail
			? [
					{ seed: detail.aSeed, name: detail.aName, text: detail.aText },
					{ seed: detail.bSeed, name: detail.bName, text: detail.bText }
				]
			: []
	);
</script>

{#if detail}
	<Card class="flex flex-col gap-5">
		<!-- Matchup header: round label, then the two entrants with their seeds. -->
		<div class="text-center">
			<div class="font-mono text-xs tracking-widest text-dim uppercase">{detail.roundLabel}</div>
			<div
				class="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-base font-semibold"
			>
				<span class="inline-flex items-center gap-1.5">
					<span class="font-mono text-xs text-dim">
						#{detail.aSeed ?? "–"}
					</span>
					{detail.aName}
				</span>
				<span class="font-mono text-xs text-dim uppercase">vs</span>
				<span class="inline-flex items-center gap-1.5">
					<span class="font-mono text-xs text-dim">
						#{detail.bSeed ?? "–"}
					</span>
					{detail.bName}
				</span>
			</div>

			<div class="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-mut">
				{detail.resolution}
			</div>
		</div>

		<!-- Judge results -->
		<div class="flex flex-col gap-2.5">
			{#each detail.votes as vote (vote.index)}
				<div
					class="vote-row items-center gap-3.5 rounded-control border border-line bg-bg2 px-3.5 py-3"
				>
					<div class={`text-sm font-semibold ${judgeText(vote.index)}`}>{vote.label}</div>
					<div class="flex flex-col gap-0.5 text-sm text-mut">
						<div>A-first → <b class="font-semibold text-tx">{vote.aFirst}</b></div>
						<div>B-first → <b class="font-semibold text-tx">{vote.bFirst}</b></div>
					</div>
					<div class="flex flex-col items-end gap-1 max-md:items-start">
						<span
							class={`rounded-chip px-2 py-0.5 font-mono text-xs ${
								vote.consistent ? "bg-ok/20 text-ok" : "bg-acc/20 text-acc"
							}`}
						>
							{vote.consistent ? "Consistent" : "Inconsistent"}
						</span>
						<span class="font-mono text-xs text-dim">
							{vote.countsFor ? `Counts → ${vote.countsFor}` : "Not counted"}
						</span>
					</div>
				</div>
			{/each}
		</div>

		<div class="border-t border-line"></div>

		<!-- Prompts: the winning entry keeps the gold border and a Winner chip beside its name. -->
		<div class="flex flex-col gap-2.5">
			{#each entrants as entry (entry.name)}
				{@const won = entry.name === detail.winnerName}

				<div class={cn("rounded-control border bg-bg2 p-3.5", won ? "border-acc/45" : "border-line")}>
					<div class="mb-2 flex items-center justify-between gap-2">
						<div class="flex items-baseline gap-2">
							<span class="font-mono text-xs text-dim">#{entry.seed ?? "–"}</span>
							<span class="text-sm font-semibold">{entry.name}</span>
						</div>
						{#if won}
							<span class="rounded-chip bg-acc/20 px-2 py-0.5 font-mono text-xs text-acc">Winner</span>
						{/if}
					</div>
					<p class="text-sm leading-relaxed text-mut text-pretty">{entry.text}</p>
				</div>
			{/each}
		</div>
	</Card>
{/if}

<style>
	.vote-row {
		display: grid;
		grid-template-columns: 200px 1fr auto;
	}

	@media (max-width: 767px) {
		.vote-row {
			grid-template-columns: 1fr;
		}
	}
</style>
