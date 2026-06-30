<script lang="ts">
	import type { Snippet } from "svelte";

	import type { RenderState } from "$lib/utilities/phases";

	import ContestHeader from "./contest-header.svelte";
	import PhaseStepper from "./phase-stepper.svelte";
	import SiteFooter from "./site-footer.svelte";

	let {
		current,
		title,
		subtitle,
		videoId,
		fingerprint,
		children
	}: {
		current: RenderState;
		title: string;
		subtitle: string;
		videoId: string;
		fingerprint: string | null;
		children: Snippet;
	} = $props();

	const wrap = "mx-auto w-full max-w-[1080px] px-6";
</script>

<div class={`sticky top-0 z-40 ${wrap}`}>
	<PhaseStepper {current} />
</div>

<header class={wrap}>
	<ContestHeader {title} {subtitle} {videoId} />
</header>

<main class={wrap}>
	{@render children()}
</main>

<footer class={wrap}>
	<SiteFooter {fingerprint} />
</footer>
