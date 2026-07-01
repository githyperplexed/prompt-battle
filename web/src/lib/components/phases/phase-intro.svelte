<script lang="ts">
	import type { Snippet } from "svelte";

	import { STEP_LABELS } from "$lib/utilities/phases";

	// Standardized phase heading: a short title (echoing the stepper) plus a one- or two-line
	// description of the current state. `children` is the description, so callers can inline rich
	// content such as a LocalTime timestamp.
	let { title, children }: { title: string; children: Snippet } = $props();

	// Derive the 1-based phase number from the title's position in the canonical step order.
	const step = $derived((STEP_LABELS as readonly string[]).indexOf(title) + 1);
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-baseline gap-2.5">
		<h2 class="m-0 text-lg font-semibold tracking-tight">{title}</h2>
		{#if step > 0}
			<span class="font-mono text-xs text-dim">Phase {step}</span>
		{/if}
	</div>
	<p class="text-sm leading-relaxed text-mut text-pretty">{@render children()}</p>
</div>
