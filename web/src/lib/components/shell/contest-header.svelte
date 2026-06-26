<script lang="ts">
	import VideoEmbed from "./video-embed.svelte";

	let { title, subtitle, videoId }: { title: string; subtitle: string; videoId: string } = $props();
</script>

<div
	class="grid grid-cols-[1fr_360px] items-start gap-[22px] pt-[26px] pb-1.5 max-[760px]:grid-cols-1"
>
	<div>
		<h1 class="m-0 text-[30px] font-bold tracking-[-0.02em]">{title}</h1>
		<p class="mt-3 mb-1 text-[15px] leading-relaxed text-mut">{subtitle}</p>
	</div>
	<VideoEmbed {videoId} />
</div>
