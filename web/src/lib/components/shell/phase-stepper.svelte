<script lang="ts">
	import { page } from "$app/state";

	import { cn } from "$lib/utilities/cn";
	import {
		PHASES,
		phaseQuery,
		STEP_LABELS,
		stepIndexFor,
		type RenderState
	} from "$lib/utilities/phases";

	let { current, progress }: { current: RenderState; progress: RenderState } = $props();

	// `currentIndex` is the phase being viewed (drives the highlight); `progressIndex` is the real
	// lifecycle position (drives the checkmark), so a completed phase stays checked even while viewed.
	// Once the contest is finished (published `complete`), the terminal Complete step is itself done,
	// so the boundary moves past the last step to check every phase.
	const currentIndex = $derived(stepIndexFor(current));
	const progressIndex = $derived(
		progress === "complete" ? STEP_LABELS.length : stepIndexFor(progress)
	);

	// Anyone can jump to any phase via the ?phase= selector; the server still gates what data (if any)
	// that phase reveals. Params owned by other phases are dropped so stale state never carries across.
	const phaseLink = (i: number) => phaseQuery(page.url.searchParams, PHASES[i]!);
</script>

<ol class="flex rounded-b-card border border-t-0 border-line bg-card px-5 py-4">
	{#each STEP_LABELS as label, i (label)}
		{@const completed = i < progressIndex}
		{@const state = i === currentIndex ? "current" : completed ? "done" : "upcoming"}

		<li class="relative flex flex-1 flex-col items-center">
			{#if i > 0}
				<span class="absolute top-5 -left-1/2 h-0.5 w-full bg-line"></span>
			{/if}

			<a
				href={phaseLink(i)}
				data-sveltekit-noscroll
				class="relative z-10 flex w-14 cursor-pointer flex-col items-center gap-2 rounded-control py-1.5 outline-none transition-colors hover:bg-card2 focus-visible:bg-card2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tx md:w-24"
			>
				<span
					class={cn(
						"z-1 flex size-7 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold",
						state === "done" && "border-mut bg-mut text-bg",
						state === "current" && "border-acc bg-acc text-ink ring-4 ring-acc/20",
						state === "upcoming" && "border-line bg-bg text-dim"
					)}
				>
					{#if completed}
						<svg
							class="size-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						{i + 1}
					{/if}
				</span>

				<span
					class={cn(
						"text-xs max-md:hidden",
						state === "done" && "text-mut",
						state === "current" && "font-semibold text-tx",
						state === "upcoming" && "text-dim"
					)}
				>
					{label}
				</span>
			</a>
		</li>
	{/each}
</ol>
