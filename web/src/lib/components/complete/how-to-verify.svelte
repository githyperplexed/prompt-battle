<script lang="ts">
	import CopyField from "$lib/components/ui/copy-field.svelte";
	import JudgeChip from "$lib/components/ui/judge-chip.svelte";
	import type { VerificationData } from "$lib/types/contest";
	import { cn } from "$lib/utilities/cn";

	let { verification }: { verification: VerificationData } = $props();

	const published = $derived(verification.published);
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

{#snippet what(text: string)}
	<p class="m-0 text-sm leading-relaxed text-mut">
		<b class="font-semibold text-tx">Check:</b>
		{text}
	</p>
{/snippet}

{#snippet why(text: string)}
	<p class="m-0 text-sm leading-relaxed text-mut">
		<b class="font-semibold text-tx">Proves:</b>
		{text}
	</p>
{/snippet}

<div class="flex flex-col gap-4">
	<div>
		<h2 class="m-0 text-xl font-bold">How to verify this result</h2>
		<p class="mt-2 text-sm leading-relaxed text-mut">
			The idea is simple: every input that decides the winner — the judges, their instructions, and
			the hidden keywords — was locked in as a hash <i>before</i> any entry was judged, and every decision
			the judges made was recorded. Each step below tells you what to check and what that check proves.
			Together they show the published result follows from the published rules and the frozen inputs —
			with nothing swapped, tuned, or hand-picked along the way.
		</p>
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(1, "The judges & their instructions", "Verifiable now", true)}
		{@render what(
			"Hash prompts/judge-score.md and prompts/judge-compare.md from the source repo and compare them to the two committed hashes below. The three judge models are listed as pinned."
		)}
		{@render why(
			"Every entry was judged by this exact panel with these exact instructions — the prompts could not have been rewritten after seeing the entries, or the hashes would no longer match."
		)}
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
		{@render what(
			"Re-hash the revealed keywords and salt (the exact method is in the source and in verification.md) and compare the result to the committed keyword hash below. The keywords stay hidden until the results are published."
		)}
		{@render why(
			"The keywords were fixed before judging began — they were not chosen afterwards to let certain entries in or keep others out."
		)}
		{#if verification.revealedKeywords && verification.revealedSalt}
			<CopyField label="Keywords" value={verification.revealedKeywords.join(", ")} />
			<CopyField label="Salt" value={verification.revealedSalt} />
		{/if}
		<CopyField label="Keyword set" value={verification.keywordHash} />
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(
			3,
			"The scored field & seeding",
			published ? "Verifiable now" : "After the results",
			published
		)}
		{@render what(
			"From the published per-model scores, recompute each entry's score (the mean of its three model totals, minus any recorded near-duplicate originality penalty), rank the field, take the top 64, and recompute the seeded-field fingerprint. Compare it to the fingerprint below."
		)}
		{@render why(
			"The ranking and bracket seeding follow mechanically from the recorded scores — no entry was moved up, dropped, or hand-placed into the bracket."
		)}
		{#if verification.similarity}
			<CopyField label="Similarity config" value={verification.similarity.hash} />
			<div class="grid gap-2 sm:grid-cols-2">
				<div class="rounded-control border border-line bg-bg2 px-3 py-2.5">
					<span class="block text-xs tracking-widest text-dim uppercase">Embedding model</span>
					<span class="font-mono text-xs text-tx">{verification.similarity.embeddingModel}</span>
				</div>
				<div class="rounded-control border border-line bg-bg2 px-3 py-2.5">
					<span class="block text-xs tracking-widest text-dim uppercase">Thresholds</span>
					<span class="font-mono text-xs text-tx">
						{verification.similarity.cosineThreshold} cosine / {verification.similarity
							.lexicalThreshold} lexical
					</span>
				</div>
			</div>
		{/if}
		<CopyField label="Bracket fingerprint" value={verification.fingerprint ?? "–"} />
	</div>

	<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
		{@render head(4, "The bracket", published ? "Verifiable now" : "After the results", published)}
		{@render what(
			"Open any matchup on the results page and recount its votes: each of the three models compared the two entries twice (A-first and B-first), a model's vote only counts if it picked the same entry both times, the majority wins, and a deadlock goes to the higher seed. Repeat down to the final."
		)}
		{@render why(
			"The champion follows from the recorded votes alone — no matchup outcome was overridden."
		)}
	</div>

	{#if verification.auditBundleUrl}
		<div class="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
			{@render head(5, "The complete record", "Downloadable now", true)}
			<p class="m-0 text-sm leading-relaxed text-mut">
				Every check above can be run offline from a single file: the frozen config, the revealed
				keywords and salt, every captured entry with its disqualification reason, every per-model
				rubric score, the full near-duplicate record, and every bracket vote. Archive it — the
				record no longer depends on this site.
			</p>
			<a
				class="self-start rounded-control border border-line bg-bg2 px-3.5 py-2 text-sm font-medium text-acc hover:border-line2"
				href={verification.auditBundleUrl}
				download
			>
				Download the audit bundle →
			</a>
		</div>
	{/if}

	<p class="text-sm leading-relaxed text-dim text-pretty">
		<b class="font-semibold text-mut">On reproducibility:</b> hosted models can change behind a
		slug, so re-running the judges is not promised to give identical scores. What is verifiable is
		that the published result follows from the recorded decisions and the inputs committed before
		judging. The full step-by-step process, with the exact formulas, is in
		<code class="font-mono text-xs text-tx">verification.md</code> in the source repo.
	</p>
</div>
