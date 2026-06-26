<script lang="ts">
	import Card from "$lib/components/ui/card.svelte";
	import type { VerificationData } from "$lib/types/contest";
	import { judgeLabel, judgeText } from "$lib/utilities/judges";

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
		<span class={`text-[13px] font-medium ${keyClass}`}>{key}</span>
		<span class="font-mono text-xs break-all text-tx">{value}</span>
	</div>
{/snippet}

<Card>
	<h3 class="m-0 mb-3 text-[17px] font-semibold">Verification record</h3>
	<p class="m-0 mb-2.5 text-[15px] leading-relaxed text-mut">
		Everything needed to independently reproduce and audit this result.
	</p>

	<div class="mt-4">
		<div class="mb-2 font-mono text-[11px] tracking-[0.12em] text-dim uppercase">
			Panel — 3 models
		</div>
		{#each verification.panel as model, i (model)}
			{@render line(judgeLabel(i), model, judgeText(i))}
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-[11px] tracking-[0.12em] text-dim uppercase">Hashes</div>
		{#each hashes as hash (hash.key)}
			{@render line(hash.key, hash.value)}
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-[11px] tracking-[0.12em] text-dim uppercase">
			Judge request settings
		</div>
		{#each verification.judgeSettings as setting (setting.key)}
			{@render line(setting.key, setting.value)}
		{/each}
	</div>

	<div class="mt-4">
		<div class="mb-2 font-mono text-[11px] tracking-[0.12em] text-dim uppercase">
			Bracket fingerprint
		</div>
		{@render line("fingerprint", verification.fingerprint ?? "—")}
	</div>
</Card>
