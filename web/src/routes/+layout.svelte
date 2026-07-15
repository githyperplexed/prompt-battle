<script lang="ts">
	import "../app.css";

	import Umami from "$lib/components/shell/umami.svelte";

	let { children } = $props();
</script>

<Umami />

{@render children()}
