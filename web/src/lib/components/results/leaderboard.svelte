<script lang="ts">
	import EntryText from "$lib/components/results/entry-text.svelte";
	import type { Judge, RankedEntry } from "$lib/types/results";
	import { cn } from "$lib/utilities/cn";
	import { formatDate, formatScore } from "$lib/utilities/format";

	let { entries, panel, seeded }: { entries: RankedEntry[]; panel: Judge[]; seeded: number } =
		$props();

	const grid =
		"grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-baseline gap-x-4 md:grid-cols-[3rem_minmax(0,1fr)_10rem_5rem_7rem]";
</script>

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Every scored entry</p>
	<h2 class="mt-3 mb-2 text-2xl font-semibold tracking-tight">
		{entries.length} entries, ranked by judge score
	</h2>
	<p class="m-0 mb-8 max-w-2xl text-sm leading-relaxed text-mut">
		Each entry's score is the mean of its three judge totals (out of 100), minus any recorded
		near-duplicate penalty. The top {seeded} were seeded into the bracket. Open a row to read the entry.
	</p>

	<div
		class={cn(
			grid,
			"border-b border-line pb-2 font-mono text-[11px] tracking-widest text-dim uppercase"
		)}
	>
		<span>#</span>
		<span>Entry</span>
		<span class="hidden text-right md:block">
			{panel.map((judge) => judge.id).join(" / ")}
		</span>
		<span class="text-right">Score</span>
		<span class="hidden text-right md:block">Bracket</span>
	</div>

	<ol class="m-0 list-none p-0">
		{#each entries as entry (entry.id)}
			<li class="border-b border-line">
				<details class="group">
					<summary class={cn(grid, "py-3 hover:bg-panel")}>
						<span class="font-mono text-sm text-dim tabular-nums">{entry.rank}</span>
						<span class="min-w-0">
							<span class="block truncate text-sm font-medium">{entry.author}</span>
							<span class="block font-mono text-[11px] text-dim">
								{formatDate(entry.submittedAt)}
								{#if entry.bracket}
									<span class="md:hidden"> · {entry.bracket.label}</span>
								{/if}
							</span>
						</span>
						<span class="hidden text-right font-mono text-xs text-mut tabular-nums md:block">
							{entry.perJudge.join(" / ")}
						</span>
						<span class="text-right font-mono text-sm tabular-nums">{formatScore(entry.score)}</span
						>
						<span
							class={cn(
								"hidden text-right text-xs md:block",
								entry.bracket?.label === "Champion" ? "font-medium text-fg" : "text-mut"
							)}
						>
							{entry.bracket?.label ?? "—"}
						</span>
					</summary>

					<div class="border-t border-line bg-panel px-4 py-5 md:ml-16">
						{#if entry.penalty > 0}
							<p class="m-0 mb-3 font-mono text-[11px] text-dim">
								raw {formatScore(entry.rawScore)} − originality penalty {formatScore(entry.penalty)}
							</p>
						{/if}
						<EntryText text={entry.text} commentUrl={entry.commentUrl} />
					</div>
				</details>
			</li>
		{/each}
	</ol>
</section>
