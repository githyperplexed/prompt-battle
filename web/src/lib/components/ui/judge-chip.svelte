<script lang="ts">
	import { judgeLabel, judgeText } from "$lib/utilities/judges";

	let { index, model }: { index: number; model: string } = $props();
</script>

<span
	class="inline-block rounded-full border border-line px-2.5 py-1 font-mono text-xs whitespace-nowrap text-mut"
>
	{judgeLabel(index)} · <span class={judgeText(index)}>{model}</span>
</span>
