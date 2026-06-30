<script lang="ts">
	import type { Champion } from "$lib/types/contest";

	let { champion }: { champion: NonNullable<Champion> } = $props();
</script>

<div
	class="relative overflow-hidden rounded-card border border-line px-9 pt-12 pb-9 text-center"
	style="background: radial-gradient(120% 150% at 50% 0, color-mix(in oklch, var(--color-acc), transparent 84%), var(--color-card) 60%)"
>
	<div class="relative z-1 mb-6 flex items-center justify-center gap-3.5">
		<span
			class="h-px w-[54px] bg-gradient-to-r from-transparent to-[color-mix(in_oklch,var(--color-acc),transparent_30%)]"
		></span>
		<span class="font-mono text-xs font-bold tracking-[0.34em] text-acc">CHAMPION</span>
		<span
			class="h-px w-[54px] bg-gradient-to-l from-transparent to-[color-mix(in_oklch,var(--color-acc),transparent_30%)]"
		></span>
	</div>

	<div
		class="relative z-1 font-mono text-8xl leading-[0.9] font-bold tracking-tighter tabular-nums text-acc [text-shadow:0_0_40px_color-mix(in_oklch,var(--color-acc),transparent_52%)] max-md:text-6xl"
	>
		{champion.score.toFixed(1)}
	</div>

	<div class="relative z-1 mt-3 font-mono text-xs tracking-[0.18em] text-mut">
		ABSOLUTE SCORE · SEED #{champion.seed}
	</div>

	<div class="relative z-1 my-4 text-2xl font-bold">
		{champion.author}
		<span class="font-mono text-sm text-dim">{champion.channelId}</span>
	</div>

	<p
		class="relative z-1 mx-auto max-w-[660px] text-left text-base leading-relaxed text-tx [text-wrap:pretty]"
	>
		{champion.comment}
	</p>
</div>
