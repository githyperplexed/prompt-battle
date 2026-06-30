<script lang="ts">
	import type { Champion } from "$lib/types/contest";

	let { champion }: { champion: NonNullable<Champion> } = $props();
</script>

<div
	class="champion relative overflow-hidden rounded-card border border-line px-9 pt-12 pb-9 text-center"
>
	<div class="relative z-1 mb-6 flex items-center justify-center gap-3.5">
		<span class="h-px w-14 bg-gradient-to-r from-transparent to-acc/70"></span>
		<span class="eyebrow font-mono text-xs font-bold text-acc">CHAMPION</span>
		<span class="h-px w-14 bg-gradient-to-l from-transparent to-acc/70"></span>
	</div>

	<div
		class="score relative z-1 font-mono text-8xl font-bold tracking-tighter tabular-nums text-acc max-md:text-6xl"
	>
		{champion.score.toFixed(1)}
	</div>

	<div class="relative z-1 mt-3 font-mono text-xs tracking-widest text-mut">
		JUDGE SCORE · SEED #{champion.seed}
	</div>

	<div class="relative z-1 my-4 text-2xl font-bold">
		{champion.author}
	</div>

	<p class="relative z-1 text-left text-base leading-relaxed text-tx text-pretty">
		{champion.comment}
	</p>
</div>

<style>
	.champion {
		background: radial-gradient(
			120% 150% at 50% 0,
			color-mix(in oklch, var(--color-acc), transparent 84%),
			var(--color-card) 60%
		);
	}

	.eyebrow {
		letter-spacing: 0.34em;
	}

	.score {
		line-height: 0.9;
		text-shadow: 0 0 40px color-mix(in oklch, var(--color-acc), transparent 52%);
	}
</style>
