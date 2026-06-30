<script lang="ts">
	import VideoEmbed from "./video-embed.svelte";

	let { title, subtitle, videoId }: { title: string; subtitle: string; videoId: string } = $props();
</script>

<div class="flex flex-col gap-6 pt-7 pb-1.5 md:flex-row md:items-start">
	<div class="md:min-w-0 md:flex-1">
		<h1 class="m-0 text-3xl font-bold tracking-tight">{title}</h1>
		<p class="mt-3 mb-1 text-base leading-relaxed text-mut">{subtitle}</p>
	</div>
	<div class="w-full md:w-90 md:shrink-0">
		<VideoEmbed {videoId} />
	</div>
</div>
