<script lang="ts">
	let { label, value }: { label: string; value: string } = $props();
</script>

<div class="border border-line bg-bg px-3 py-2.5">
	<span class="block text-[11px] tracking-widest text-dim uppercase">{label}</span>
	<span class="mt-1 block font-mono text-xs break-all text-fg select-all">{value}</span>
</div>
