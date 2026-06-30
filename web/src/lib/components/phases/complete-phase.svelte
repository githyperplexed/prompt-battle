<script lang="ts">
	import Bracket from "$lib/components/complete/bracket.svelte";
	import ChampionCard from "$lib/components/complete/champion-card.svelte";
	import VerificationPanel from "$lib/components/complete/verification-panel.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { CompleteData, ContestMeta } from "$lib/types/contest";

	let { contest, complete }: { contest: ContestMeta; complete: CompleteData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	{#if complete.champion}
		<ChampionCard champion={complete.champion} />
	{/if}

	{#if complete.rounds.length > 0}
		<Bracket rounds={complete.rounds} contestId={contest.id} />
	{:else}
		<Card class="py-9 text-center text-mut">Bracket results are not available yet.</Card>
	{/if}

	<VerificationPanel verification={complete.verification} />
</section>
