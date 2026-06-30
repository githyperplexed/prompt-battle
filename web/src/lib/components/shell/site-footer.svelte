<script lang="ts">
	let { fingerprint }: { fingerprint: string | null } = $props();
</script>

<div
	class="mt-10 mb-12 flex flex-wrap items-center justify-between gap-3.5 border-t border-line pt-5"
>
	<div class="text-sm text-mut">
		Open-source · independently verifiable contest.
		<a class="font-medium text-acc" href="/rules">Read the rules & integrity hashes →</a>
	</div>

	{#if fingerprint}
		<div class="font-mono text-xs text-dim">contest · {fingerprint}</div>
	{/if}
</div>
