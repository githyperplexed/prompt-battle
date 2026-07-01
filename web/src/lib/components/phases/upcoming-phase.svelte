<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import { stepIndexFor, STEP_LABELS, type RenderState } from "$lib/utilities/phases";

	import PhaseIntro from "./phase-intro.svelte";

	// Shown when a visitor navigates ahead to a phase the contest hasn't reached yet. `phase` is the
	// viewed step, used only to label the placeholder with that phase's name.
	let { phase }: { phase: RenderState } = $props();

	const label = $derived(STEP_LABELS[stepIndexFor(phase)] ?? "This phase");
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title={label}>
		This phase hasn't happened yet. It unlocks once the contest reaches it.
	</PhaseIntro>

	<Card class="flex flex-col items-center gap-3.5 px-7 py-14 text-center">
		<h3 class="m-0 text-2xl font-bold">Not here yet</h3>
		<p class="max-w-md text-base leading-relaxed text-mut">
			The contest hasn't advanced to this phase, so there's nothing to show. Follow along and it'll
			fill in as the contest progresses.
		</p>
	</Card>
</section>
