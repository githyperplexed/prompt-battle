<script lang="ts">
	import { formatLocal, formatUtc } from "$lib/utilities/format";

	let { iso }: { iso: string } = $props();

	// Render UTC on the server and during hydration (deterministic), then switch to the viewer's
	// local time once mounted — the server can't know the client timezone, so this avoids a mismatch.
	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});
</script>

<time datetime={iso}>{mounted ? formatLocal(iso) : formatUtc(iso)}</time>
