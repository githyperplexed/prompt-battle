<script lang="ts">
	import EntryList from "$lib/components/entries/entry-list.svelte";
	import DqBreakdown from "$lib/components/snapshot/dq-breakdown.svelte";
	import FieldSummary from "$lib/components/snapshot/field-summary.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import LocalTime from "$lib/components/ui/local-time.svelte";
	import type { ContestMeta, EntryListData, SnapshotData } from "$lib/types/contest";

	import PhaseIntro from "./phase-intro.svelte";

	let {
		contest,
		snapshot,
		entries
	}: { contest: ContestMeta; snapshot: SnapshotData; entries: EntryListData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Snapshot">
		{#if snapshot.eligible === 0}
			The field froze on <LocalTime iso={contest.capturedAt} /> with no eligible entries, so nothing
			advances to judging.
		{:else}
			The snapshot is the entry field frozen on <LocalTime iso={contest.capturedAt} /> and screened
			for eligibility. Only these entries advance to judging.
		{/if}
	</PhaseIntro>

	<FieldSummary
		total={snapshot.total}
		eligible={snapshot.eligible}
		disqualified={snapshot.disqualified}
	/>

	{#if snapshot.eligible === 0}
		<Card class="py-9 text-center text-mut">
			No eligible entries were captured in this snapshot. The contest field is empty, so nothing
			advances to judging.
		</Card>
	{:else}
		<DqBreakdown dq={snapshot.dq} />
		<EntryList data={entries} />
	{/if}
</section>
