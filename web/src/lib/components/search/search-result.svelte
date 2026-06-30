<script lang="ts">
	import { cn } from "$lib/utilities/cn";
	import type { SearchOutcome } from "$lib/types/contest";

	let { result, showRank }: { result: SearchOutcome; showRank: boolean } = $props();
</script>

<div
	class={cn(
		"mt-3 rounded-control border p-4",
		result.kind === "eligible" && "border-[color-mix(in_oklch,var(--color-ok),transparent_55%)]",
		result.kind === "disqualified" &&
			"border-[color-mix(in_oklch,var(--color-bad),transparent_55%)]",
		result.kind === "none" && "border-line"
	)}
>
	{#if result.kind === "none"}
		<span class="text-dim">No captured entry matches “{result.query}”.</span>
	{:else}
		<div class="mb-2.5 flex flex-wrap items-center gap-2.5">
			{#if result.kind === "eligible"}
				<span
					class="rounded-chip bg-[color-mix(in_oklch,var(--color-ok),transparent_82%)] px-2.5 py-1 text-xs font-semibold text-ok"
				>
					✓ Captured · Eligible
				</span>
			{:else}
				<span
					class="rounded-chip bg-[color-mix(in_oklch,var(--color-bad),transparent_82%)] px-2.5 py-1 text-xs font-semibold text-bad"
				>
					✕ Disqualified
				</span>
				<span class="font-mono text-xs text-dim">{result.reasonLabel}</span>
			{/if}
		</div>

		<div class="mb-1 text-base font-semibold">
			{result.author}
			<span class="font-mono text-xs text-dim">{result.channelId}</span>
		</div>

		{#if result.kind === "eligible" && showRank && result.rank !== null}
			<div class="mb-2 font-mono text-sm text-acc">
				Rank #{result.rank} · {result.seed !== null
					? `Seed #${result.seed} · advances`
					: "Below the cut"}
			</div>
		{/if}

		{#if result.kind === "disqualified" && result.redacted}
			<div class="border-l-2 border-line2 pl-2.5 font-mono text-sm text-dim italic">
				Comment body redacted — removed under content policy.
			</div>
		{:else if result.comment}
			<p class="m-0 text-base leading-relaxed text-mut [text-wrap:pretty]">{result.comment}</p>
		{/if}
	{/if}
</div>
