<script lang="ts">
	let { fingerprint }: { fingerprint: string | null } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const copy = async () => {
		if (!fingerprint) return;

		try {
			await navigator.clipboard.writeText(fingerprint);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard unavailable; ignore
		}
	};
</script>

<div
	class="mt-10 mb-12 flex flex-wrap items-center justify-between gap-3.5 border-t border-line pt-5"
>
	<div class="text-sm text-mut">
		Open-source · independently verifiable contest.
		<a class="font-medium text-acc" href="/rules">Read the rules & integrity hashes →</a>
		<div class="mt-1.5 flex gap-3.5 text-xs text-dim">
			<a class="hover:text-mut" href="/privacy">Privacy</a>
			<a class="hover:text-mut" href="/terms">Terms</a>
		</div>
	</div>

	{#if fingerprint}
		<button
			type="button"
			class="flex min-w-0 max-w-full items-center gap-1.5 font-mono text-xs text-dim hover:text-mut"
			onclick={copy}
			title="Copy bracket fingerprint"
		>
			<span class="flex-none">fingerprint ·</span>
			<span class="min-w-0 truncate">{fingerprint}</span>
			<span class="flex-none text-acc">{copied ? "copied" : ""}</span>
		</button>
	{/if}
</div>
