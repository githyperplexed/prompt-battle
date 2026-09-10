<script lang="ts">
	import { env } from "$env/dynamic/public";

	// Env-gated so local builds and forks ship no tracker; set both in web/.env before building.
	const url = env.PUBLIC_UMAMI_SCRIPT_URL;
	const id = env.PUBLIC_UMAMI_WEBSITE_ID;
</script>

<svelte:head>
	{#if url && id}
		<script async defer src={url} data-website-id={id}></script>
	{/if}
</svelte:head>
