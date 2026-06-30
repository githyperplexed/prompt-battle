<script lang="ts">
	import LocalTime from "$lib/components/ui/local-time.svelte";
	import type { EntryListData } from "$lib/types/contest";
	import { dqLabel } from "$lib/utilities/labels";

	let { data }: { data: EntryListData } = $props();

	const PREVIEW = 100;

	let query = $state("");
	let applied = $state("");
	let expanded = $state<Record<string, boolean>>({});

	// Debounce the filter so a large list isn't re-diffed on every keystroke.
	$effect(() => {
		const next = query;
		const timer = setTimeout(() => (applied = next), 150);

		return () => clearTimeout(timer);
	});

	const filtered = $derived.by(() => {
		const q = applied.trim().toLowerCase();
		if (!q) return data.entries;

		return data.entries.filter(
			(e) => e.author.toLowerCase().includes(q) || e.channelId.toLowerCase().includes(q)
		);
	});

	const toggle = (id: string) => {
		expanded = { ...expanded, [id]: !expanded[id] };
	};
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-baseline justify-between gap-2.5">
		<h3 class="m-0 text-lg font-semibold">All entries</h3>
		<span class="font-mono text-xs text-dim">
			{#if data.capped}
				showing first {data.entries.length.toLocaleString()} of {data.total.toLocaleString()}
			{:else}
				{data.total.toLocaleString()} entries
			{/if}
		</span>
	</div>

	<input
		class="w-full rounded-control border border-line bg-bg2 px-3.5 py-2.5 text-sm text-tx outline-none focus:border-acc"
		placeholder="Filter by author or channel id…"
		bind:value={query}
	/>

	<div class="overflow-hidden rounded-card border border-line bg-card">
		{#if filtered.length === 0}
			<div class="py-9 text-center text-sm text-dim">No entries match “{applied}”.</div>
		{:else}
			{#each filtered as e (e.id)}
				{@const long = !e.redacted && e.text.length > PREVIEW}
				{@const open = expanded[e.id] ?? false}
				<button
					type="button"
					class="entry flex w-full flex-col gap-1 border-t border-line px-5 py-3 text-left transition-colors first:border-t-0 hover:bg-card2"
					onclick={() => long && toggle(e.id)}
				>
					<div class="flex items-baseline justify-between gap-3">
						<span class="min-w-0 truncate font-medium">{e.author}</span>
						<span class="flex-none font-mono text-xs text-dim"><LocalTime iso={e.submittedAt} /></span>
					</div>
					{#if e.dqReason}
						<div>
							<span class="rounded-chip bg-bad/20 px-2 py-0.5 font-mono text-xs text-bad">
								{dqLabel(e.dqReason)}
							</span>
						</div>
					{/if}
					{#if e.redacted}
						<p class="text-sm text-dim italic">Comment body redacted under content policy.</p>
					{:else}
						<p class="text-sm leading-relaxed text-mut text-pretty">
							{open || !long ? e.text : `${e.text.slice(0, PREVIEW)}…`}
						</p>
						{#if long}
							<span class="font-mono text-xs text-acc">{open ? "Show less" : "Show more"}</span>
						{/if}
					{/if}
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	/* Skip layout/paint for off-screen rows so a multi-thousand-row list stays smooth. */
	.entry {
		content-visibility: auto;
		contain-intrinsic-size: auto 84px;
	}
</style>
