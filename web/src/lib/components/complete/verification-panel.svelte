<script lang="ts">
	import JudgeChip from "$lib/components/ui/judge-chip.svelte";
	import type { VerificationData } from "$lib/types/contest";

	let { verification }: { verification: VerificationData } = $props();

	const hashes = $derived([
		{ key: "Scoring prompt", value: verification.scorePromptHash },
		{ key: "Comparison prompt", value: verification.comparePromptHash },
		{ key: "Keyword set", value: verification.keywordHash }
	]);
</script>

{#snippet line(key: string, value: string, keyClass = "text-mut")}
	<div
		class="mb-1.5 flex items-center justify-between gap-3.5 rounded-control border border-line bg-bg2 px-3 py-2.5"
	>
		<span class={`text-sm font-medium ${keyClass}`}>{key}</span>
		<span class="font-mono text-xs break-all text-tx">{value}</span>
	</div>
{/snippet}

<div>
	<h3 class="m-0 mb-1 text-lg font-semibold">Verification record</h3>
	<p class="m-0 mb-2.5 text-sm leading-relaxed text-mut">
		Everything needed to independently reproduce and audit this result.
	</p>

	<div class="mt-4">
		<div class="mb-2 font-mono text-xs tracking-widest text-dim uppercase">
			Panel · 3 models
		</div>
		<div class="flex flex-wrap gap-2">
			{#each verification.panel as model, i (model)}
				<JudgeChip index={i} {model} />
			{/each}
		</div>
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-xs tracking-widest text-dim uppercase">Hashes</div>
		{#each hashes as hash (hash.key)}
			{@render line(hash.key, hash.value)}
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-xs tracking-widest text-dim uppercase">
			Judge request settings
		</div>
		{#each verification.judgeSettings as setting (setting.key)}
			{@render line(setting.key, setting.value)}
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-xs tracking-widest text-dim uppercase">
			Bracket fingerprint
		</div>
		{@render line("fingerprint", verification.fingerprint ?? "–")}
	</div>
</div>
