<script lang="ts">
	let {
		pct,
		eligible,
		judges
	}: { pct: number; eligible: number; judges: number } = $props();

	const degrees = $derived(((Math.min(100, pct) / 100) * 360).toFixed(1));
</script>

<div
	class="flex size-52 items-center justify-center rounded-full"
	style={`background: conic-gradient(var(--color-acc) ${degrees}deg, var(--color-line) 0)`}
>
	<div class="flex size-40 flex-col items-center justify-center rounded-full bg-card">
		<div class="font-mono text-5xl font-bold tracking-tight tabular-nums text-acc">
			{pct.toFixed(0)}%
		</div>
		<div class="text-xs tracking-widest text-dim uppercase">judged</div>
	</div>
</div>

<div class="font-mono text-sm text-mut">
	{eligible.toLocaleString()} entries × {judges} judges
</div>
