<script lang="ts">
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import { CONTEST_TITLE } from "$lib/utilities/copy";

	const heading = "text-xl font-semibold mt-8 mb-2";
	const body = "m-0 mb-4 text-base leading-relaxed text-mut";
</script>

<SiteHead
	title={`Privacy · ${CONTEST_TITLE}`}
	description="What this site collects, how contest entries are handled, and the third-party services involved."
/>

<div class="mx-auto w-full max-w-page px-6 py-10">
	<a class="text-sm text-mut hover:text-tx" href="/">← Back to the contest</a>

	<h1 class="mt-5 mb-2 text-3xl font-bold">Privacy</h1>
	<p class={body}>
		This site exists to display contest state. It has no accounts, no ads, and sets no tracking
		cookies.
	</p>

	<h2 class={heading}>Analytics</h2>
	<p class={body}>
		This site uses Umami, a privacy-focused analytics tool, to count visits and see which pages get
		used. The data is anonymous and aggregated, no cookies are involved, and it does not track you
		across other websites.
	</p>

	<h2 class={heading}>Contest entries</h2>
	<p class={body}>
		Entries are public YouTube comments. This site uses YouTube API Services to fetch them, so the
		<a class="text-acc" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
			YouTube Terms of Service
		</a>
		and the
		<a class="text-acc" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
			Google Privacy Policy
		</a>
		apply to that data. Snapshotted entries are shown with their public channel name, are scored by third-party
		AI models, and become part of the published audit record described on the
		<a class="text-acc" href="/rules">rules page</a>. Entries removed for content policy reasons
		have their text blanked on this site and in the audit record.
	</p>

	<h2 class={heading}>Judging services</h2>
	<p class={body}>
		Entry text is sent to the AI judging panel through OpenRouter and to OpenAI for content
		moderation and similarity embeddings. Operational traces of judging calls are retained for at
		most 30 days.
	</p>

	<h2 class={heading}>Email updates</h2>
	<p class={body}>
		If you submit your email in the updates form, it is sent to hyperplexed.io and stored with
		Resend, our email provider. It is used only to send contest updates. Every email includes a
		one-click unsubscribe link.
	</p>

	<h2 class={heading}>Embedded content</h2>
	<p class={body}>
		The contest video is embedded with YouTube's privacy-enhanced player (youtube-nocookie.com).
		Fonts are loaded from Google Fonts, which means your browser makes requests to Google servers
		when the page loads.
	</p>

	<h2 class={heading}>Contact</h2>
	<p class={body}>
		Questions about this policy or your data:
		<a class="text-acc" href="mailto:hello@hyperplexed.io">hello@hyperplexed.io</a>
	</p>
</div>
