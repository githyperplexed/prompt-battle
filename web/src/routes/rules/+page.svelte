<script lang="ts">
	import VerificationPanel from "$lib/components/complete/verification-panel.svelte";
	import Card from "$lib/components/ui/card.svelte";

	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const REPO = "https://github.com/githyperplexed/prompt-battle";
	const RULES_URL = `${REPO}/blob/main/rules.md`;

	const link =
		"rounded-control border border-line bg-card px-3.5 py-2 text-sm font-medium text-acc hover:border-line2";
</script>

<svelte:head>
	<title>Rules & verification</title>
</svelte:head>

<div class="mx-auto w-full max-w-[1080px] px-[22px] py-10">
	<a class="text-[13px] text-mut hover:text-tx" href="/">← Back to the contest</a>

	<h1 class="mt-5 mb-2 text-[28px] font-bold">Rules &amp; verification</h1>
	<p class="m-0 mb-6 max-w-[680px] text-[15px] leading-relaxed text-mut">
		This contest runs on an open-source engine. The rules, the judging code, and every recorded
		decision are public — and the judging inputs are committed as hashes before any entry is judged,
		so anyone can confirm the contest used the published rules and the exact frozen inputs.
	</p>

	<div class="mb-7 flex flex-wrap gap-2.5">
		<a class={link} href={RULES_URL} target="_blank" rel="noreferrer">Full rules (rules.md) →</a>
		<a class={link} href={REPO} target="_blank" rel="noreferrer">Source code →</a>
	</div>

	{#if data.verification}
		<p class="m-0 mb-3.5 max-w-[680px] text-[14px] leading-relaxed text-mut">
			These commitments were frozen when the contest was created. The
			<b class="font-semibold text-tx">keyword set</b> is a salted hash of the hidden keywords (the
			words stay secret until the reveal, then anyone can re-hash them to check). The
			<b class="font-semibold text-tx">prompt</b> hashes pin the exact judge instructions, and the
			<b class="font-semibold text-tx">bracket fingerprint</b> pins the seeded field that produced the
			winner.
		</p>

		<VerificationPanel verification={data.verification} />
	{:else}
		<Card class="text-center text-mut">No active contest to verify yet.</Card>
	{/if}
</div>
