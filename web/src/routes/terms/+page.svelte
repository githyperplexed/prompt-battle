<script lang="ts">
	import SiteFooter from "$lib/components/shell/site-footer.svelte";
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import { CONTEST_TITLE } from "$lib/contest.js";

	const heading = "mt-10 mb-2 text-xl font-semibold tracking-tight";
	const body = "m-0 mb-4 max-w-2xl text-base leading-relaxed text-mut";
	const link = "text-fg underline-offset-4 hover:underline";
</script>

<SiteHead
	title={`Terms · ${CONTEST_TITLE}`}
	description="The terms that apply to using this site and to the contest."
/>

<main class="mx-auto w-full max-w-page px-6">
	<header class="border-b border-line pt-16 pb-10">
		<a class="text-sm text-mut hover:text-fg" href="/">← Back to the results</a>
		<h1 class="mt-6 mb-4 text-4xl font-semibold tracking-tight">Terms</h1>
		<p class="m-0 max-w-2xl text-base leading-relaxed text-mut">
			By using this site or entering the contest, you agree to these terms and to the contest rules.
		</p>
	</header>

	<h2 class={heading}>The contest</h2>
	<p class={body}>
		Entry was by commenting on the contest video during the open window. Eligibility,
		disqualification, judging, and tie-breaks are governed by the published
		<a class={link} href="/rules">rules</a>, which are the authoritative version of how the winner
		was decided. Results are final once published, and the full decision record is public and
		independently verifiable.
	</p>

	<h2 class={heading}>Your entry</h2>
	<p class={body}>
		Entries are public YouTube comments and remain subject to YouTube's own terms. By entering, you
		understood that your comment text and public channel name would be displayed on this site,
		scored by third-party AI models, and included in the permanent public audit record.
	</p>

	<h2 class={heading}>Fair play</h2>
	<p class={body}>
		Entries that violated the rules, including content policy violations and entries from affiliated
		accounts, were disqualified as described in the rules. Disqualification decisions are recorded
		in the audit record.
	</p>

	<h2 class={heading}>No warranty</h2>
	<p class={body}>
		The site and the contest are provided as-is, without warranty of any kind. To the maximum extent
		permitted by law, the operator is not liable for damages arising from use of the site or
		participation in the contest.
	</p>

	<h2 class={heading}>Changes</h2>
	<p class={body}>
		These terms may be updated between contests. The rules of a running contest are never changed
		while it is live.
	</p>

	<h2 class={heading}>Contact</h2>
	<p class={body}>
		Questions:
		<a class={link} href="mailto:hello@hyperplexed.io">hello@hyperplexed.io</a>
	</p>

	<SiteFooter />
</main>
