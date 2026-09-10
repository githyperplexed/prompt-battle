<script lang="ts">
	import Bracket from "$lib/components/results/bracket.svelte";
	import Champion from "$lib/components/results/champion.svelte";
	import Disqualified from "$lib/components/results/disqualified.svelte";
	import Leaderboard from "$lib/components/results/leaderboard.svelte";
	import Stats from "$lib/components/results/stats.svelte";
	import SiteFooter from "$lib/components/shell/site-footer.svelte";
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import Subscribe from "$lib/components/shell/subscribe.svelte";
	import { CONTEST_SUBTITLE, CONTEST_TITLE, META_DESCRIPTION, REPO_URL } from "$lib/contest.js";

	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const link = "border border-line px-4 py-2 text-sm text-mut hover:border-fg hover:text-fg";
	const videoUrl = $derived(`https://www.youtube.com/watch?v=${data.meta.videoId}`);
</script>

<SiteHead title={`${CONTEST_TITLE} — Final results`} description={META_DESCRIPTION} />

<main class="mx-auto w-full max-w-page px-6">
	<header class="border-b border-line pt-16 pb-12">
		<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">
			Prompt Battle · Final results
		</p>
		<h1 class="mt-4 mb-4 text-5xl font-semibold tracking-tight max-sm:text-4xl">
			{CONTEST_TITLE}
		</h1>
		<p class="m-0 max-w-2xl text-base leading-relaxed text-mut">{CONTEST_SUBTITLE}</p>

		<nav class="mt-8 flex flex-wrap gap-2">
			<a class={link} href={videoUrl} target="_blank" rel="noreferrer">Watch the video ↗</a>
			<a class={link} href="/rules">Rules &amp; verification</a>
			<a class={link} href={REPO_URL} target="_blank" rel="noreferrer">Source ↗</a>
		</nav>
	</header>

	{#if data.champion}
		<Champion champion={data.champion} rounds={data.rounds.length} />
	{/if}

	<Stats stats={data.stats} meta={data.meta} />

	{#if data.rounds.length}
		<Bracket rounds={data.rounds} />
	{/if}

	<Leaderboard entries={data.ranked} panel={data.meta.panel} seeded={data.stats.seeded} />

	<Disqualified entries={data.disqualified} stats={data.stats} />

	<Subscribe />

	<SiteFooter fingerprint={data.verification.bracketFingerprint} />
</main>
