<script lang="ts">
	// A label + long value row. Below md the value drops beneath its label; the value truncates with
	// an ellipsis and copies to the clipboard on click, mirroring the footer's fingerprint control.
	let { label, value }: { label: string; value: string } = $props();

	const copyable = $derived(!!value && value !== "–");

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const copy = async () => {
		if (!copyable) return;

		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard unavailable; ignore
		}
	};
</script>

<div
	class="mb-1.5 flex flex-col items-start gap-1 rounded-control border border-line bg-bg2 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:gap-3.5"
>
	<span class="flex-none text-sm font-medium text-mut">{label}</span>

	{#if copyable}
		<button
			type="button"
			class="flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 font-mono text-xs text-tx hover:text-mut"
			onclick={copy}
			title={`Copy ${label}`}
		>
			<span class="min-w-0 truncate">{value}</span>
			<span class="flex-none text-acc">{copied ? "copied" : ""}</span>
		</button>
	{:else}
		<span class="font-mono text-xs text-tx">{value}</span>
	{/if}
</div>
