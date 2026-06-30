<script lang="ts">
	import Leaderboard from "$lib/components/scored/leaderboard.svelte";
	import FindYourEntry from "$lib/components/search/find-your-entry.svelte";
	import type { ContestMeta, LeaderboardData } from "$lib/types/contest";

	let { contest, leaderboard }: { contest: ContestMeta; leaderboard: LeaderboardData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<FindYourEntry contestId={contest.id} showRank={true} />
	<Leaderboard data={leaderboard} contestId={contest.id} />
</section>
