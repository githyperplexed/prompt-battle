<script lang="ts">
	import type { Snippet } from "svelte";

	import { cn } from "$lib/utilities/cn";

	let { class: className = "", children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class={cn(
		"rounded-card border border-line bg-card p-6 shadow-card",
		className
	)}
>
	{@render children()}
</div>
