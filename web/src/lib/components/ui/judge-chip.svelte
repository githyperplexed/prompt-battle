<script lang="ts">
	import { judgeLabel, judgeText } from "$lib/utilities/judges";

	let { index, model }: { index: number; model: string } = $props();
</script>

<span class="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-mut">
	{judgeLabel(index)} · <span class={judgeText(index)}>{model}</span>
</span>
