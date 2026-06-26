<script lang="ts">
	let { videoId }: { videoId: string } = $props();
</script>

<div class="aspect-video overflow-hidden rounded-control border border-line bg-bg2">
	<iframe
		class="size-full"
		src={`https://www.youtube-nocookie.com/embed/${videoId}`}
		title="Contest video"
		loading="lazy"
		referrerpolicy="strict-origin-when-cross-origin"
		allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
		allowfullscreen
	></iframe>
</div>
