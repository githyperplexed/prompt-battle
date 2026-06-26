<script lang="ts">
	import type { MatrixRow } from "$lib/types/contest";
	import { judgeBorder, judgeText } from "$lib/utilities/judges";

	let { matrix, score }: { matrix: MatrixRow[]; score: number } = $props();

	const dims = ["Persu.", "Orig.", "Clev.", "Exec."];
</script>

<div class="overflow-x-auto">
	<table class="w-full min-w-[420px] border-collapse text-[13px]">
		<thead>
			<tr>
				<th class="px-2 py-1.5 text-left text-xs font-medium text-dim">Judge</th>
				{#each dims as dim (dim)}
					<th class="px-2 py-1.5 text-right text-xs font-medium text-dim">{dim}</th>
				{/each}
				<th class="px-2 py-1.5 text-right text-xs font-medium text-dim">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each matrix as row (row.index)}
				<tr>
					<td
						class={`border-t border-l-[3px] border-line py-2 pr-2 pl-2.5 text-left font-medium ${judgeBorder(row.index)} ${judgeText(row.index)}`}
					>
						{row.label}
					</td>
					<td class="border-t border-line px-2 py-2 text-right font-mono tabular-nums">
						{row.persuasiveness}
					</td>
					<td class="border-t border-line px-2 py-2 text-right font-mono tabular-nums">
						{row.originality}
					</td>
					<td class="border-t border-line px-2 py-2 text-right font-mono tabular-nums">
						{row.cleverness}
					</td>
					<td class="border-t border-line px-2 py-2 text-right font-mono tabular-nums">
						{row.execution}
					</td>
					<td class="border-t border-line px-2 py-2 text-right font-mono font-bold tabular-nums">
						{row.total}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<div class="mt-3 text-right font-mono text-xs text-dim">
	Absolute score = mean of the three judge totals = {score.toFixed(1)}
</div>
