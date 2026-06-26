<script lang="ts">
	import Countdown from "$lib/components/open/countdown.svelte";
	import HowJudgingWorks from "$lib/components/open/how-judging-works.svelte";
	import HowToEnter from "$lib/components/open/how-to-enter.svelte";
	import type { ContestMeta } from "$lib/types/contest";

	let { contest }: { contest: ContestMeta } = $props();
</script>

<section class="flex flex-col gap-[18px] pt-[26px]">
	<Countdown snapshotAt={contest.snapshotAt} />

	<div class="grid grid-cols-2 gap-[18px] max-[760px]:grid-cols-1">
		<HowToEnter />
		<HowJudgingWorks panel={contest.panel} />
	</div>
</section>
