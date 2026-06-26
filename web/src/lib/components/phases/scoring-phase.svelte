<script lang="ts">
	import { invalidateAll } from "$app/navigation";

	import PerJudgeBars from "$lib/components/scoring/per-judge-bars.svelte";
	import ScoringRadial from "$lib/components/scoring/scoring-radial.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { ScoringData } from "$lib/types/contest";

	let { scoring }: { scoring: ScoringData } = $props();

	const pct = $derived(scoring.total > 0 ? Math.min(100, (scoring.done / scoring.total) * 100) : 0);

	// Live progress: re-run the load periodically while judging is in flight.
	$effect(() => {
		const timer = setInterval(() => invalidateAll(), 4000);

		return () => clearInterval(timer);
	});
</script>

<section class="flex flex-col gap-[18px] pt-[26px]">
	<div class="text-sm text-mut">
		Each of the three judges is scoring every eligible entry independently. No individual scores or
		rankings are shown until judging completes.
	</div>

	<Card class="flex flex-col items-center gap-[18px] py-[34px]">
		<ScoringRadial
			{pct}
			done={scoring.done}
			total={scoring.total}
			eligible={scoring.eligible}
			judges={scoring.perModel.length}
		/>
		<PerJudgeBars perModel={scoring.perModel} eligible={scoring.eligible} />
	</Card>
</section>
