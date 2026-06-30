<script lang="ts">
	import EntryList from "$lib/components/entries/entry-list.svelte";
	import PerJudgeBars from "$lib/components/scoring/per-judge-bars.svelte";
	import ScoringRadial from "$lib/components/scoring/scoring-radial.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { EntryListData, ScoringData } from "$lib/types/contest";

	let { scoring, entries }: { scoring: ScoringData; entries: EntryListData } = $props();

	const pct = $derived(scoring.total > 0 ? Math.min(100, (scoring.done / scoring.total) * 100) : 0);
</script>

<section class="flex flex-col gap-5 pt-7">
	<div class="text-sm text-mut">
		Each of the three judges is scoring every eligible entry independently. No individual scores or
		rankings are shown until judging completes.
	</div>

	<Card class="flex flex-col items-center gap-5 py-9">
		<ScoringRadial
			{pct}
			done={scoring.done}
			total={scoring.total}
			eligible={scoring.eligible}
			judges={scoring.perModel.length}
		/>
		<PerJudgeBars perModel={scoring.perModel} eligible={scoring.eligible} />
	</Card>

	<EntryList data={entries} />
</section>
