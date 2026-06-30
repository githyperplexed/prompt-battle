<script lang="ts">
	import { dev } from "$app/environment";
	import { page } from "$app/state";

	import { cn } from "$lib/utilities/cn";
	import {
		PHASES,
		phaseQuery,
		STEP_LABELS,
		stepIndexFor,
		type RenderState
	} from "$lib/utilities/phases";

	let { current }: { current: RenderState } = $props();

	const currentIndex = $derived(stepIndexFor(current));

	// Dev-only: each step links to its phase via the ?phase= override, dropping params owned by other
	// phases so stale state never carries across a phase switch.
	const phaseLink = (i: number) => phaseQuery(page.url.searchParams, PHASES[i]!);
</script>

<ol class="flex rounded-b-card border border-t-0 border-line bg-card px-[18px] py-4">
	{#each STEP_LABELS as label, i (label)}
		{@const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"}

		<li class="relative flex flex-1 flex-col items-center">
			{#if i > 0}
				<span class="absolute top-[13px] -left-1/2 h-0.5 w-full bg-line"></span>
			{/if}

			<svelte:element
				this={dev ? "a" : "div"}
				href={dev ? phaseLink(i) : undefined}
				data-sveltekit-noscroll
				class={cn("flex flex-col items-center gap-2", dev && "cursor-pointer")}
			>
				<span
					class={cn(
						"z-[1] flex size-7 items-center justify-center rounded-full border-2 font-mono text-[13px] font-semibold",
						state === "done" && "border-mut bg-mut text-bg",
						state === "current" &&
							"border-acc bg-acc text-ink shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-acc),transparent_80%)]",
						state === "upcoming" && "border-line bg-bg text-dim"
					)}
				>
					{i + 1}
				</span>

				<span
					class={cn(
						"text-xs max-[760px]:hidden",
						state === "done" && "text-mut",
						state === "current" && "font-semibold text-tx",
						state === "upcoming" && "text-dim"
					)}
				>
					{label}
				</span>
			</svelte:element>
		</li>
	{/each}
</ol>
