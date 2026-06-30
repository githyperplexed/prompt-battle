<script lang="ts">
	import Leaderboard from "$lib/components/scored/leaderboard.svelte";
	import type { LeaderboardData } from "$lib/types/contest";

	let { leaderboard }: { leaderboard: LeaderboardData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<Leaderboard data={leaderboard} />
</section>
