<script lang="ts">
	let {
		pct,
		done,
		total,
		eligible,
		judges
	}: { pct: number; done: number; total: number; eligible: number; judges: number } = $props();

	const degrees = $derived(((Math.min(100, pct) / 100) * 360).toFixed(1));
</script>

<div
	class="flex size-[210px] items-center justify-center rounded-full"
	style={`background: conic-gradient(var(--color-acc) ${degrees}deg, var(--color-line) 0)`}
>
	<div class="flex size-[158px] flex-col items-center justify-center rounded-full bg-card">
		<div class="font-mono text-[46px] font-bold tracking-[-0.02em] tabular-nums text-acc">
			{pct.toFixed(0)}%
		</div>
		<div class="text-xs tracking-[0.12em] text-dim uppercase">judged</div>
	</div>
</div>

<div class="font-mono text-[13px] text-mut">
	{done.toLocaleString()} / {total.toLocaleString()} scores · {eligible.toLocaleString()} entries × {judges}
	judges
</div>
