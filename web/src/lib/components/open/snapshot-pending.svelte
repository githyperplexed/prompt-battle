<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import LocalTime from "$lib/components/ui/local-time.svelte";

	// Shown once the snapshot cutoff has passed but the field hasn't been captured yet: entries are
	// locked, and the snapshot/judging follow. Replaces the live countdown for this transient state.
	let { snapshotAt, videoPublishedAt }: { snapshotAt: string; videoPublishedAt: string } = $props();

	const windowHours = $derived(
		Math.round((new Date(snapshotAt).getTime() - new Date(videoPublishedAt).getTime()) / 3_600_000)
	);
</script>

<Card class="flex flex-col items-center gap-4 px-8 py-10 text-center">
	<span
		class="flex size-12 items-center justify-center rounded-full border-2 border-acc/40 bg-acc/10 text-acc"
	>
		<svg
			class="size-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="4" y="11" width="16" height="9" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		</svg>
	</span>

	<div class="flex flex-col gap-2">
		<h2 class="m-0 text-2xl font-bold">Entries are closed</h2>
		<p class="text-base leading-relaxed text-mut text-pretty">
			The entry window has closed and the field is frozen — comments posted or edited after the
			cutoff don't count. The snapshot is being captured now; the eligible field, rankings, and
			judging follow once it completes.
		</p>
	</div>

	<div class="font-mono text-xs text-dim">
		Snapshot at <LocalTime iso={snapshotAt} /> · {windowHours.toLocaleString()}h after publish
	</div>
</Card>
