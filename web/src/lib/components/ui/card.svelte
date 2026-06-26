<script lang="ts">
	import type { Snippet } from "svelte";

	import { cn } from "$lib/utilities/cn";

	let { class: className = "", children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class={cn(
		"rounded-card border border-line bg-card p-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_16px_32px_-26px_rgba(0,0,0,0.7)]",
		className
	)}
>
	{@render children()}
</div>
