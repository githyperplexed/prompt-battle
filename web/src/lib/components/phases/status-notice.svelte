<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";

	let { tag, heading, body }: { tag: string; heading: string; body: string } = $props();
</script>

<div class="mx-auto w-full max-w-[1080px] px-[22px] pt-[26px]">
	<Card class="flex flex-col items-center gap-3.5 px-7 py-14 text-center">
		<span
			class="rounded-control border border-[color-mix(in_oklch,var(--color-acc),transparent_60%)] px-3 py-1.5 font-mono text-xs tracking-[0.18em] text-acc"
		>
			{tag}
		</span>
		<h2 class="m-0 text-[26px] font-bold">{heading}</h2>
		<p class="max-w-[460px] text-[15px] leading-relaxed text-mut">{body}</p>
	</Card>
</div>
