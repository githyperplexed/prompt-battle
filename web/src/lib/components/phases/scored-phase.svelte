<script lang="ts">
	import Leaderboard from "$lib/components/scored/leaderboard.svelte";
	import type { LeaderboardData } from "$lib/types/contest";

	import PhaseIntro from "./phase-intro.svelte";

	let { leaderboard }: { leaderboard: LeaderboardData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Ranked">
		With judging complete, every eligible entry is ranked by its combined judge score. The
		top-scoring entries advance to the final bracket.
	</PhaseIntro>

	<Leaderboard data={leaderboard} />
</section>
