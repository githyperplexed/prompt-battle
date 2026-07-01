<script lang="ts">
	import CompletePhase from "$lib/components/phases/complete-phase.svelte";
	import LockedPhase from "$lib/components/phases/locked-phase.svelte";
	import OpenPhase from "$lib/components/phases/open-phase.svelte";
	import ScoredPhase from "$lib/components/phases/scored-phase.svelte";
	import ScoringPhase from "$lib/components/phases/scoring-phase.svelte";
	import SnapshotPhase from "$lib/components/phases/snapshot-phase.svelte";
	import StatusNotice from "$lib/components/phases/status-notice.svelte";
	import UpcomingPhase from "$lib/components/phases/upcoming-phase.svelte";
	import ContestShell from "$lib/components/shell/contest-shell.svelte";
	import Card from "$lib/components/ui/card.svelte";

	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

{#if data.state === "not_found" || !data.contest}
	<StatusNotice
		tag="404"
		heading="No contest found"
		body="We couldn't find a contest to show. Check the link, or head back to the contest index."
	/>
{:else if data.state === "draft"}
	<StatusNotice
		tag="DRAFT"
		heading="Contest is being set up"
		body="This contest hasn't opened yet. Check back soon."
	/>
{:else}
	<ContestShell
		current={data.view ?? data.state}
		progress={data.progress ?? data.state}
		title={data.contest.title}
		subtitle={data.contest.subtitle}
		videoId={data.contest.videoId}
		fingerprint={data.contest.fingerprint}
	>
		{#if data.state === "open"}
			<OpenPhase contest={data.contest} />
		{:else if data.state === "snapshotted" && data.snapshot && data.entries}
			<SnapshotPhase contest={data.contest} snapshot={data.snapshot} entries={data.entries} />
		{:else if data.state === "scoring" && data.scoring && data.entries}
			<ScoringPhase scoring={data.scoring} entries={data.entries} />
		{:else if data.state === "scored" && data.leaderboard}
			<ScoredPhase leaderboard={data.leaderboard} />
		{:else if data.state === "complete" && data.complete}
			<CompletePhase complete={data.complete} />
		{:else if data.state === "locked"}
			<LockedPhase />
		{:else if data.state === "upcoming"}
			<UpcomingPhase phase={data.view ?? data.state} />
		{:else}
			<section class="pt-7">
				<Card class="py-9 text-center text-mut">This phase’s view lands in the next pass.</Card>
			</section>
		{/if}
	</ContestShell>
{/if}
