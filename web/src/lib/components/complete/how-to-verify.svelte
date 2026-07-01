<script lang="ts">
	import CopyField from "$lib/components/ui/copy-field.svelte";
	import JudgeChip from "$lib/components/ui/judge-chip.svelte";
	import type { VerificationData } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";

	let { verification }: { verification: VerificationData } = $props();

	const revealed = $derived(!!(verification.revealedKeywords?.length && verification.revealedSalt));
</script>

{#snippet head(n: number, title: string, tag: string, now: boolean)}
	<div class="flex items-center gap-2.5">
		<span
			class="flex size-7 flex-none items-center justify-center rounded-full border-2 border-line bg-bg font-mono text-sm font-semibold"
		>
			{n}
		</span>
		<h3 class="m-0 text-base font-semibold">{title}</h3>
		<span
			class={cn(
				"ml-auto font-mono text-xs tracking-widest uppercase",
				now ? "text-ok" : "text-dim"
			)}
		>
			{tag}
		</span>
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	<div>
		<h2 class="m-0 text-xl font-bold">How to verify this result</h2>
		<p class="mt-2 text-sm leading-relaxed text-mut">
			The judging inputs below were committed as hashes when the contest was created — before a
			single entry was scored. Once the results are published you can reproduce each step and check
			it against these commitments. Here's how, in order.
		</p>
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(1, "The judges & their instructions", "Verifiable now", true)}
		<p class="text-sm leading-relaxed text-mut">
			Three independent models — one per provider — scored every entry, using instructions frozen at
			creation. Hash <code class="font-mono text-xs text-tx">prompts/judge-score.md</code> and
			<code class="font-mono text-xs text-tx">prompts/judge-compare.md</code> in the source and compare
			them to the committed hashes below.
		</p>
		<div class="flex flex-wrap gap-2">
			{#each verification.panel as model, i (model)}
				<JudgeChip index={i} {model} />
			{/each}
		</div>
		<CopyField label="Scoring prompt" value={verification.scorePromptHash} />
		<CopyField label="Comparison prompt" value={verification.comparePromptHash} />
		{#each verification.judgeSettings as setting (setting.key)}
			<div
				class="flex items-center justify-between gap-3.5 rounded-control border border-line bg-bg2 px-3 py-2.5"
			>
				<span class="text-sm font-medium text-mut">{setting.key}</span>
				<span class="font-mono text-xs text-tx">{setting.value}</span>
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(
			2,
			"The hidden keywords",
			revealed ? "Verifiable now" : "After the reveal",
			revealed
		)}
		<p class="text-sm leading-relaxed text-mut">
			A salted hash of the three keywords was committed before judging — proof they were fixed in
			advance, not chosen to fit the entries. Re-hash the revealed keywords and salt (the method is
			in the source) and compare to this hash. They stay hidden until the results are published.
		</p>
		{#if verification.revealedKeywords && verification.revealedSalt}
			<CopyField label="Keywords" value={verification.revealedKeywords.join(", ")} />
			<CopyField label="Salt" value={verification.revealedSalt} />
		{/if}
		<CopyField label="Keyword set" value={verification.keywordHash} />
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(3, "The scored field & seeding", "After the results", false)}
		<p class="text-sm leading-relaxed text-mut">
			Every eligible entry was scored once by each model; an entry's absolute score is the mean of
			the three totals. From the published per-model scores, recompute each absolute score, rank the
			field, and take the top 64. That seeded field is fingerprinted — recompute the fingerprint and
			compare to this one.
		</p>
		<CopyField label="Bracket fingerprint" value={verification.fingerprint ?? "–"} />
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(4, "The bracket", "After the results", false)}
		<p class="text-sm leading-relaxed text-mut">
			Each matchup was judged by all three models both ways — A-first and B-first — to cancel
			position bias; a vote counts only if the model picks the same entry regardless of order, and
			the majority wins (a deadlock goes to the higher seed). Every matchup's per-model votes are
			shown on the results, so you can replay them down to the single winner.
		</p>
	</div>

	<p class="text-sm leading-relaxed text-dim text-pretty">
		<b class="font-semibold text-mut">On reproducibility:</b> hosted models can change behind a slug,
		so exact re-scoring isn't promised. The audit verifies the recorded decisions against the frozen inputs
		and committed hashes — not live re-inference.
	</p>
</div>
