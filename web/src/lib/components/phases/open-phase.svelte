<script lang="ts">
	import Countdown from "$lib/components/open/countdown.svelte";
	import HowJudgingWorks from "$lib/components/open/how-judging-works.svelte";
	import HowToEnter from "$lib/components/open/how-to-enter.svelte";
	import SnapshotPending from "$lib/components/open/snapshot-pending.svelte";
	import Subscribe from "$lib/components/shell/subscribe.svelte";
	import type { ContestMeta } from "$lib/types/contest";

	import PhaseIntro from "./phase-intro.svelte";

	let { contest }: { contest: ContestMeta } = $props();

	// Entries close at the snapshot cutoff. Past it, the live countdown gives way to the pending
	// panel until the worker captures the snapshot and the contest advances.
	let now = $state(Date.now());

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);

		return () => clearInterval(timer);
	});

	const closed = $derived(now >= new Date(contest.snapshotAt).getTime());
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Open">
		During the open window, anyone can enter by commenting on the contest video. The field freezes
		at snapshot, and comments posted afterward aren't counted.
	</PhaseIntro>

	{#if closed}
		<SnapshotPending snapshotAt={contest.snapshotAt} videoPublishedAt={contest.videoPublishedAt} />
	{:else}
		<Countdown snapshotAt={contest.snapshotAt} videoPublishedAt={contest.videoPublishedAt} {now} />
	{/if}

	<div class="grid grid-cols-2 gap-5 max-md:grid-cols-1">
		<HowToEnter />
		<HowJudgingWorks panel={contest.panel} />
	</div>

	<Subscribe />
</section>
