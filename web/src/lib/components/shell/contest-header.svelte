<script lang="ts">
	import VideoEmbed from "./video-embed.svelte";

	let { title, subtitle, videoId }: { title: string; subtitle: string; videoId: string } = $props();
</script>

<div
	class="grid grid-cols-[1fr_360px] items-start gap-6 pt-7 pb-1.5 max-md:grid-cols-1"
>
	<div>
		<h1 class="m-0 text-3xl font-bold tracking-tight">{title}</h1>
		<p class="mt-3 mb-1 text-base leading-relaxed text-mut">{subtitle}</p>
	</div>
	<VideoEmbed {videoId} />
</div>
