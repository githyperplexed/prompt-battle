<script lang="ts">
	import SiteFooter from "$lib/components/shell/site-footer.svelte";
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import { CONTEST_TITLE } from "$lib/contest.js";

	const heading = "mt-10 mb-2 text-xl font-semibold tracking-tight";
	const body = "m-0 mb-4 max-w-2xl text-base leading-relaxed text-mut";
	const link = "text-fg underline-offset-4 hover:underline";
</script>

<SiteHead
	title={`Privacy · ${CONTEST_TITLE}`}
	description="What this site collects, how contest entries are handled, and the third-party services involved."
/>

<main class="mx-auto w-full max-w-page px-6">
	<header class="border-b border-line pt-16 pb-10">
		<a class="text-sm text-mut hover:text-fg" href="/">← Back to the results</a>
		<h1 class="mt-6 mb-4 text-4xl font-semibold tracking-tight">Privacy</h1>
		<p class="m-0 max-w-2xl text-base leading-relaxed text-mut">
			This site is a static record of a finished contest. It has no accounts, no ads, no database,
			and sets no tracking cookies.
		</p>
	</header>

	<h2 class={heading}>Analytics</h2>
	<p class={body}>
		This site may use Umami, a privacy-focused analytics tool, to count visits. The data is
		anonymous and aggregated, no cookies are involved, and it does not track you across other
		websites.
	</p>

	<h2 class={heading}>Contest entries</h2>
	<p class={body}>
		Entries are public YouTube comments, fetched during the contest through YouTube API Services, so
		the
		<a class={link} href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
			YouTube Terms of Service
		</a>
		and the
		<a class={link} href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
			Google Privacy Policy
		</a>
		apply to that data. Entries are shown with their public channel name, were scored by third-party AI
		models, and are part of the published audit record described on the
		<a class={link} href="/rules">rules page</a>. Entries removed for content policy reasons have
		their text blanked on this site and in the audit record.
	</p>

	<h2 class={heading}>Judging services</h2>
	<p class={body}>
		During the contest, entry text was sent to the AI judging panel through OpenRouter and to OpenAI
		for content moderation and similarity embeddings. Operational traces of judging calls were
		retained for at most 30 days.
	</p>

	<h2 class={heading}>Email updates</h2>
	<p class={body}>
		If you submit your email in the updates form, it is sent to hyperplexed.io and stored with
		Resend, our email provider. It is used only to send contest updates. Every email includes a
		one-click unsubscribe link.
	</p>

	<h2 class={heading}>Fonts</h2>
	<p class={body}>
		Fonts are loaded from Google Fonts, which means your browser makes requests to Google servers
		when the page loads.
	</p>

	<h2 class={heading}>Contact</h2>
	<p class={body}>
		Questions about this policy or your data:
		<a class={link} href="mailto:hello@hyperplexed.io">hello@hyperplexed.io</a>
	</p>

	<SiteFooter />
</main>
