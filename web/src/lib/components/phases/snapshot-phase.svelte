<script lang="ts">
	import FindYourEntry from "$lib/components/search/find-your-entry.svelte";
	import DqBreakdown from "$lib/components/snapshot/dq-breakdown.svelte";
	import FieldSummary from "$lib/components/snapshot/field-summary.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { ContestMeta, SnapshotData } from "$lib/types/contest";
	import { formatUtc } from "$lib/utilities/format";

	let { contest, snapshot }: { contest: ContestMeta; snapshot: SnapshotData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<div class="text-sm text-mut">
		Field frozen on {formatUtc(contest.capturedAt)} · Judging hasn't begun yet.
	</div>

	<FieldSummary
		total={snapshot.total}
		eligible={snapshot.eligible}
		disqualified={snapshot.disqualified}
	/>

	{#if snapshot.eligible === 0}
		<Card class="py-9 text-center text-mut">
			No eligible entries were captured in this snapshot. The contest field is empty — nothing
			advances to judging.
		</Card>
	{:else}
		<DqBreakdown dq={snapshot.dq} />
		<FindYourEntry contestId={contest.id} />
	{/if}
</section>
