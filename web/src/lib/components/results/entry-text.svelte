<script lang="ts">
	let {
		text,
		commentUrl,
		redacted = false
	}: { text: string; commentUrl: string; redacted?: boolean } = $props();
</script>

{#if redacted}
	<p class="m-0 text-sm text-dim italic">Text withheld — removed for content policy.</p>
{:else}
	<p class="m-0 text-[15px] leading-relaxed break-words whitespace-pre-line text-fg/90">{text}</p>
{/if}

<a
	class="mt-4 inline-block text-xs text-mut underline-offset-4 hover:text-fg hover:underline"
	href={commentUrl}
	target="_blank"
	rel="noreferrer"
>
	View the comment on YouTube ↗
</a>
