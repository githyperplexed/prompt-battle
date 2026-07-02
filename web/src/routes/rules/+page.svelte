<script lang="ts">
	import HowToVerify from "$lib/components/complete/how-to-verify.svelte";
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import Card from "$lib/components/ui/card.svelte";
	import { CONTEST_TITLE } from "$lib/utilities/copy";

	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const REPO = "https://github.com/githyperplexed/prompt-battle";
	const RULES_URL = `${REPO}/blob/main/rules.md`;
	const VERIFY_URL = `${REPO}/blob/main/verification.md`;

	const link =
		"rounded-control border border-line bg-card px-3.5 py-2 text-sm font-medium text-acc hover:border-line2";
</script>

<SiteHead
	title={`Rules & verification — ${CONTEST_TITLE}`}
	description="How the contest is judged and how anyone can verify the result — committed keyword hashes, frozen judging inputs, and the public audit record."
/>

<div class="mx-auto w-full max-w-page px-6 py-10">
	<a class="text-sm text-mut hover:text-tx" href="/">← Back to the contest</a>

	<h1 class="mt-5 mb-2 text-3xl font-bold">Rules &amp; verification</h1>
	<p class="m-0 mb-6 text-base leading-relaxed text-mut">
		This contest runs on an open-source engine. The rules, the judging code, and every recorded
		decision are public. The judging inputs are committed as hashes before any entry is judged, so
		anyone can confirm the contest used the published rules and the exact frozen inputs.
	</p>

	<div class="mb-7 flex flex-wrap gap-2.5">
		<a class={link} href={RULES_URL} target="_blank" rel="noreferrer">Full rules (rules.md) →</a>
		<a class={link} href={VERIFY_URL} target="_blank" rel="noreferrer">
			Verification guide (verification.md) →
		</a>
		<a class={link} href={REPO} target="_blank" rel="noreferrer">Source code →</a>
	</div>

	{#if data.verification}
		<HowToVerify verification={data.verification} />
	{:else}
		<Card class="text-center text-mut">No active contest to verify yet.</Card>
	{/if}
</div>
