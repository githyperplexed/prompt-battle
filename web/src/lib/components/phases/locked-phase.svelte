<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";

	import PhaseIntro from "./phase-intro.svelte";
</script>

<section class="flex flex-col gap-5 pt-7">
	<PhaseIntro title="Complete">
		The bracket has resolved behind the scenes. The ranked leaderboard is already public, but the
		bracket and champion stay hidden until the results video is published.
	</PhaseIntro>

	<Card class="flex flex-col items-center gap-3.5 px-7 py-14 text-center">
		<h3 class="m-0 text-2xl font-bold">The bracket is locked until the reveal</h3>
		<p class="max-w-md text-base leading-relaxed text-mut">
			The head-to-head bracket, the champion, and the verification record all unlock when the
			results video goes live. In the meantime, the full ranked field is available on the Ranked
			step.
		</p>
		<div class="font-mono text-sm text-dim">Unlocks on reveal day</div>
	</Card>
</section>
