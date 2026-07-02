<script lang="ts">
	import LocalTime from "$lib/components/ui/local-time.svelte";
	import type { EntryListData, EntryStatus } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";
	import { hasTextSelection } from "$lib/utilities/dom";
	import { dqLabel } from "$lib/utilities/labels";

	let {
		data,
		dqReason = null,
		status = null,
		onClearDq,
		onClearStatus
	}: {
		data: EntryListData;
		dqReason?: string | null;
		status?: EntryStatus | null;
		onClearDq?: () => void;
		onClearStatus?: () => void;
	} = $props();

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

		return data.entries.filter((e) => {
			const matchesStatus =
				!status || (status === "eligible" ? e.dqReason === null : e.dqReason !== null);
			const matchesDq = !dqReason || e.dqReason === dqReason;
			const matchesQuery =
				!q || e.author.toLowerCase().includes(q) || e.channelId.toLowerCase().includes(q);

			return matchesStatus && matchesDq && matchesQuery;
		});
	});

	const toggle = (id: string) => {
		if (hasTextSelection()) return;
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

	<div class="flex flex-col gap-2">
		<input
			class="w-full rounded-control border border-line bg-bg2 px-3.5 py-2.5 text-sm text-tx outline-none focus:border-tx"
			placeholder="Filter by author or channel id…"
			bind:value={query}
		/>
		{#if status}
			<div class="flex items-center justify-between gap-3 text-sm text-mut">
				<span>
					Showing <span class="font-medium text-tx">{status} entries</span>
				</span>
				<button type="button" class="text-dim hover:underline" onclick={() => onClearStatus?.()}>
					Clear
				</button>
			</div>
		{/if}
		{#if dqReason}
			<div class="flex items-center justify-between gap-3 text-sm text-mut">
				<span>
					Showing <span class="font-medium text-tx">{dqLabel(dqReason)}</span>
				</span>
				<button type="button" class="text-dim hover:underline" onclick={() => onClearDq?.()}>
					Clear
				</button>
			</div>
		{/if}
	</div>

	<div class="overflow-hidden rounded-card border border-line bg-card">
		{#if filtered.length === 0}
			<div class="py-9 text-center text-sm text-dim">
				{dqReason
					? `No entries match ${dqLabel(dqReason)}.`
					: status
						? `No ${status} entries match.`
						: `No entries match “${applied}”.`}
			</div>
		{:else}
			{#each filtered as e (e.id)}
				{@const long = !e.redacted && e.text.length > PREVIEW}
				{@const open = expanded[e.id] ?? false}
				<button
					type="button"
					class={cn(
						"entry flex w-full cursor-text flex-col gap-1 border-t border-line px-5 py-3 text-left transition-colors outline-none select-text first:rounded-t-card first:border-t-0 last:rounded-b-card hover:bg-card2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tx",
						long && "cursor-pointer"
					)}
					onclick={() => long && toggle(e.id)}
				>
					<div class="flex items-baseline justify-between gap-3">
						<span class="min-w-0 truncate font-medium">{e.author}</span>
						<span class="flex-none font-mono text-xs text-dim"
							><LocalTime iso={e.submittedAt} /></span
						>
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
							<span class="font-mono text-xs text-mut">{open ? "Show less" : "Show more"}</span>
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
