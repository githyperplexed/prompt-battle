<script lang="ts">
	import Bracket from "$lib/components/complete/bracket.svelte";
	import ChampionCard from "$lib/components/complete/champion-card.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import type { CompleteData } from "$lib/types/contest";

	import PhaseIntro from "./phase-intro.svelte";

	let { complete }: { complete: CompleteData } = $props();
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Complete">
		The contest is settled. The champion, the head-to-head bracket, and the verification record are
		all final.
	</PhaseIntro>

	{#if complete.champion}
		<ChampionCard champion={complete.champion} />
	{/if}

	{#if complete.rounds.length > 0}
		<Bracket rounds={complete.rounds} details={complete.details} />
	{:else}
		<Card class="py-9 text-center text-mut">Bracket results are not available yet.</Card>
	{/if}
</section>
