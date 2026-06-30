<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { MatchupDetail } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";
	import { judgeText } from "$lib/utilities/judges";

	let { contestId, matchupId }: { contestId: string; matchupId: string | null } = $props();

	let detail = $state<MatchupDetail | null>(null);

	$effect(() => {
		if (!matchupId) {
			detail = null;
			return;
		}

		const params = new URLSearchParams({ contest: contestId, matchup: matchupId });
		let cancelled = false;

		fetch(`/api/matchup-detail?${params}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (!cancelled) detail = data;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if detail}
	<div class="flex flex-col gap-5">
		<Card>
			<div class="mb-3.5 flex flex-wrap items-baseline gap-3">
				<span class="font-mono text-dim">{detail.roundLabel}</span>
				<span class="text-base font-semibold">
					#{detail.aSeed}
					{detail.aName} vs #{detail.bSeed}
					{detail.bName}
				</span>
			</div>

			<div class="flex flex-col gap-2.5">
				{#each detail.votes as vote (vote.index)}
					<div
						class="grid grid-cols-[200px_1fr_auto] items-center gap-3.5 rounded-control border border-line bg-bg2 px-3.5 py-3 max-md:grid-cols-1"
					>
						<div class={`text-sm font-semibold ${judgeText(vote.index)}`}>{vote.label}</div>
						<div class="flex flex-col gap-0.5 text-sm text-mut">
							<div>A-first → <b class="font-semibold text-tx">{vote.aFirst}</b></div>
							<div>B-first → <b class="font-semibold text-tx">{vote.bFirst}</b></div>
						</div>
						<div class="flex flex-col items-end gap-1 max-md:items-start">
							<span
								class={`rounded-chip px-2 py-0.5 font-mono text-xs ${
									vote.consistent
										? "bg-[color-mix(in_oklch,var(--color-ok),transparent_80%)] text-ok"
										: "bg-[color-mix(in_oklch,var(--color-acc),transparent_80%)] text-acc"
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
		</Card>

		<Card>
			<span class="mb-3 block font-mono text-xs tracking-widest text-dim uppercase"
				>Entries</span
			>

			<div class="flex flex-col gap-2.5">
				{#each [{ seed: detail.aSeed, name: detail.aName, text: detail.aText }, { seed: detail.bSeed, name: detail.bName, text: detail.bText }] as entry (entry.name)}
					{@const won = entry.name === detail.winnerName}

					<div
						class={cn(
							"rounded-control border bg-bg2 p-3.5",
							won ? "border-[color-mix(in_oklch,var(--color-acc),transparent_55%)]" : "border-line"
						)}
					>
						<div class="mb-2 flex items-baseline gap-2">
							<span class="font-mono text-xs text-dim">#{entry.seed ?? "—"}</span>
							<span class="text-sm font-semibold">{entry.name}</span>
							{#if won}
								<span
									class="rounded-chip bg-[color-mix(in_oklch,var(--color-acc),transparent_82%)] px-2 py-0.5 font-mono text-xs text-acc"
								>
									Winner
								</span>
							{/if}
						</div>
						<p class="text-sm leading-relaxed text-mut [text-wrap:pretty]">{entry.text}</p>
					</div>
				{/each}
			</div>
		</Card>

		<Card
			class="border-[color-mix(in_oklch,var(--color-acc),transparent_66%)] bg-[color-mix(in_oklch,var(--color-acc),transparent_90%)]"
		>
			<div class="flex flex-col gap-1">
				<span class="font-bold text-acc">Winner: {detail.winnerName}</span>
				<span class="text-base leading-relaxed text-mut">{detail.resolution}</span>
			</div>
		</Card>
	</div>
{/if}
