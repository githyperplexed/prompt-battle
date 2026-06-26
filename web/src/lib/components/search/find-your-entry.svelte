<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { SearchOutcome } from "$lib/types/contest";

	import SearchResult from "./search-result.svelte";

	let { contestId, showRank = false }: { contestId: string; showRank?: boolean } = $props();

	let query = $state("");
	let result = $state<SearchOutcome | null>(null);

	$effect(() => {
		const q = query.trim();

		if (!q) {
			result = null;
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const params = new URLSearchParams({ contest: contestId, q });

			try {
				const res = await fetch(`/api/entry-search?${params}`, { signal: controller.signal });

				if (res.ok) result = await res.json();
			} catch {
				// aborted by a newer keystroke; ignore
			}
		}, 250);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
</script>

<Card>
	<h3 class="m-0 mb-3 text-[17px] font-semibold">Find your entry</h3>
	<input
		class="w-full rounded-control border border-line bg-bg2 px-3.5 py-2.5 text-sm text-tx outline-none focus:border-acc"
		placeholder="Search channel id or author name…"
		bind:value={query}
	/>

	{#if result}
		<SearchResult {result} {showRank} />
	{/if}
</Card>
