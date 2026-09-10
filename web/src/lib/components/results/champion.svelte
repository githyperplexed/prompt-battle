<script lang="ts">
	import EntryText from "$lib/components/results/entry-text.svelte";
	import type { Champion } from "$lib/types/results";
	import { formatScore } from "$lib/utilities/format";

	let { champion }: { champion: Champion } = $props();
</script>

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Champion</p>

	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
		<div>
			<h2 class="m-0 text-4xl font-semibold tracking-tight max-sm:text-3xl">
				<a class="hover:underline" href={champion.channelUrl} target="_blank" rel="noreferrer">
					{champion.author}
				</a>
			</h2>
			<p class="m-0 mt-2 font-mono text-xs tracking-widest text-mut uppercase">
				Seed #{champion.seed} · Rank #{champion.rank} · Won {champion.wins} of {champion.rounds} matchups
			</p>
		</div>

		<div class="text-right">
			<div class="font-mono text-7xl leading-none font-bold tracking-tighter tabular-nums">
				{formatScore(champion.score)}
			</div>
			<div class="mt-2 font-mono text-[11px] tracking-widest text-dim uppercase">Judge score</div>
		</div>
	</div>

	<div class="mt-8 border border-line bg-panel p-6">
		<EntryText text={champion.text} commentUrl={champion.commentUrl} />
	</div>
</section>
