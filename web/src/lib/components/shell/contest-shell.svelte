<script lang="ts">
	import type { Snippet } from "svelte";

	import { navigating } from "$app/state";

	import { cn } from "$lib/utilities/cn";
	import type { RenderState } from "$lib/utilities/phases";

	import ContestHeader from "./contest-header.svelte";
	import PageSkeleton from "./page-skeleton.svelte";
	import PhaseStepper from "./phase-stepper.svelte";
	import SiteFooter from "./site-footer.svelte";

	let {
		current,
		progress,
		title,
		subtitle,
		videoId,
		fingerprint,
		children
	}: {
		current: RenderState;
		progress: RenderState;
		title: string;
		subtitle: string;
		videoId: string;
		fingerprint: string | null;
		children: Snippet;
	} = $props();

	const wrap = "mx-auto w-full max-w-page px-6";

	// While a navigation is in flight, fill the viewport so the skeleton can size itself to the
	// space between the divider and the footer without ever introducing a scrollbar.
	const loading = $derived(!!navigating.to);
</script>

<div class={cn("flex flex-col", loading && "min-h-dvh")}>
	<div class={`sticky top-0 z-40 ${wrap}`}>
		<PhaseStepper {current} {progress} />
	</div>

	<header class={wrap}>
		<ContestHeader {title} {subtitle} {videoId} />
	</header>

	<div class={`${wrap} pt-6`}>
		<div class="border-t border-line"></div>
	</div>

	<main class={cn(wrap, loading && "flex min-h-0 flex-1 flex-col")}>
		{#if loading}
			<PageSkeleton />
		{:else}
			{@render children()}
		{/if}
	</main>

	<footer class={wrap}>
		<SiteFooter {fingerprint} />
	</footer>
</div>
