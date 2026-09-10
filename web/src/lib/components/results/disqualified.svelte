<script lang="ts">
	import EntryText from "$lib/components/results/entry-text.svelte";
	import type { DisqualifiedEntry, Stats } from "$lib/types/results";
	import { formatDate } from "$lib/utilities/format";

	let { entries, stats }: { entries: DisqualifiedEntry[]; stats: Stats } = $props();
</script>

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Disqualified</p>
	<h2 class="mt-3 mb-2 text-2xl font-semibold tracking-tight">
		{entries.length} entries did not qualify
	</h2>
	<p class="m-0 mb-6 max-w-2xl text-sm leading-relaxed text-mut">
		Eligibility is mechanical and checked against the rules published before the contest. Every
		disqualification and its reason is in the audit record.
	</p>

	<ul class="m-0 mb-6 flex list-none flex-wrap gap-2 p-0">
		{#each stats.dq as item (item.reason)}
			<li class="border border-line px-3 py-1.5 text-xs text-mut">
				{item.label} <span class="ml-1 font-mono text-dim tabular-nums">{item.count}</span>
			</li>
		{/each}
	</ul>

	<details class="group border border-line">
		<summary class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
			<span>All {entries.length} disqualified entries</span>
			<span class="font-mono text-xs text-dim group-open:hidden">show</span>
			<span class="hidden font-mono text-xs text-dim group-open:inline">hide</span>
		</summary>

		<ol class="m-0 list-none border-t border-line p-0">
			{#each entries as entry (entry.id)}
				<li class="border-b border-line last:border-b-0">
					<details class="group/row">
						<summary
							class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-4 py-3 hover:bg-panel"
						>
							<span class="min-w-0">
								<span class="block truncate text-sm">{entry.author}</span>
								<span class="block font-mono text-[11px] text-dim">
									{formatDate(entry.submittedAt)}
								</span>
							</span>
							<span class="text-right text-xs text-mut">{entry.label}</span>
						</summary>
						<div class="border-t border-line bg-panel px-4 py-5">
							<EntryText
								text={entry.text}
								commentUrl={entry.commentUrl}
								redacted={entry.redacted}
							/>
						</div>
					</details>
				</li>
			{/each}
		</ol>
	</details>
</section>
