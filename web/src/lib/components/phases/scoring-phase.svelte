<script lang="ts">
	import EntryList from "$lib/components/entries/entry-list.svelte";
	import PerJudgeBars from "$lib/components/scoring/per-judge-bars.svelte";
	import ScoringRadial from "$lib/components/scoring/scoring-radial.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { EntryListData, ScoringData } from "$lib/types/contest";

	import PhaseIntro from "./phase-intro.svelte";

	let { scoring, entries }: { scoring: ScoringData; entries: EntryListData } = $props();

	const pct = $derived(scoring.total > 0 ? Math.min(100, (scoring.done / scoring.total) * 100) : 0);
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Scoring">
		Each of the three judges scores every eligible entry independently. Individual scores and
		rankings stay hidden until judging is complete.
	</PhaseIntro>

	<Card class="flex flex-col items-center gap-5 py-9">
		<ScoringRadial
			{pct}
			eligible={scoring.eligible}
			judges={scoring.perModel.length}
		/>
		<PerJudgeBars perModel={scoring.perModel} eligible={scoring.eligible} />
	</Card>

	<EntryList data={entries} />
</section>
