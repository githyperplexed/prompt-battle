<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";

	let { tag, heading, body }: { tag: string; heading: string; body: string } = $props();
</script>

<div class="mx-auto w-full max-w-page px-6 pt-7">
	<Card class="flex flex-col items-center gap-3.5 px-7 py-14 text-center">
		<span
			class="rounded-control border border-acc/40 px-3 py-1.5 font-mono text-xs tracking-widest text-acc"
		>
			{tag}
		</span>
		<h2 class="m-0 text-2xl font-bold">{heading}</h2>
		<p class="max-w-md text-base leading-relaxed text-mut">{body}</p>
	</Card>
</div>
