<script lang="ts">
	import { REPO_URL } from "$lib/contest.js";

	let { fingerprint = null }: { fingerprint?: string | null } = $props();

	const link = "text-mut underline-offset-4 hover:text-fg hover:underline";
</script>

<footer class="mt-16 flex flex-col gap-4 border-t border-line pt-6 pb-12 text-sm">
	<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
		<a class={link} href="/">Results</a>
		<a class={link} href="/rules">Rules &amp; verification</a>
		<a class={link} href={REPO_URL} target="_blank" rel="noreferrer">Source</a>
		<a class={link} href="/privacy">Privacy</a>
		<a class={link} href="/terms">Terms</a>
	</div>

	<p class="m-0 text-xs leading-relaxed text-dim">
		An open-source, independently verifiable contest. Every decision behind this result is in the
		public audit record.
	</p>

	{#if fingerprint}
		<p class="m-0 font-mono text-[11px] leading-relaxed break-all text-dim">
			bracket fingerprint · {fingerprint}
		</p>
	{/if}
</footer>
