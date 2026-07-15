<script lang="ts">
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import { CONTEST_TITLE } from "$lib/utilities/copy";

	const heading = "text-xl font-semibold mt-8 mb-2";
	const body = "m-0 mb-4 text-base leading-relaxed text-mut";
</script>

<SiteHead
	title={`Terms · ${CONTEST_TITLE}`}
	description="The terms that apply to using this site and entering the contest."
/>

<div class="mx-auto w-full max-w-page px-6 py-10">
	<a class="text-sm text-mut hover:text-tx" href="/">← Back to the contest</a>

	<h1 class="mt-5 mb-2 text-3xl font-bold">Terms</h1>
	<p class={body}>
		By using this site or entering the contest, you agree to these terms and to the contest rules.
	</p>

	<h2 class={heading}>The contest</h2>
	<p class={body}>
		Entry is by commenting on the contest video during the open window. Eligibility,
		disqualification, judging, and tie-breaks are governed by the published
		<a class="text-acc" href="/rules">rules</a>, which are the authoritative version of how a winner
		is decided. Results are final once published, and the full decision record is public and
		independently verifiable.
	</p>

	<h2 class={heading}>Your entry</h2>
	<p class={body}>
		Entries are public YouTube comments and remain subject to YouTube's own terms. By entering, you
		understand that your comment text and public channel name will be displayed on this site, scored
		by third-party AI models, and included in the permanent public audit record.
	</p>

	<h2 class={heading}>Fair play</h2>
	<p class={body}>
		Entries that violate the rules, including content policy violations and entries from affiliated
		accounts, may be disqualified as described in the rules. Disqualification decisions are recorded
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
		<a class="text-acc" href="mailto:hello@hyperplexed.io">hello@hyperplexed.io</a>
	</p>
</div>
