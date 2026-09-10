<script lang="ts">
	import SiteFooter from "$lib/components/shell/site-footer.svelte";
	import SiteHead from "$lib/components/shell/site-head.svelte";
	import HashField from "$lib/components/ui/hash-field.svelte";
	import { CONTEST_TITLE, REPO_URL } from "$lib/contest.js";
	import { formatBytes } from "$lib/utilities/format";

	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const v = $derived(data.verification);
	const RULES_URL = `${REPO_URL}/blob/main/rules.md`;
	const VERIFY_URL = `${REPO_URL}/blob/main/verification.md`;

	const link = "border border-line px-4 py-2 text-sm text-mut hover:border-fg hover:text-fg";
</script>

<SiteHead
	title={`Rules & verification — ${CONTEST_TITLE}`}
	description="How the contest was judged and how anyone can verify the result — committed keyword hashes, frozen judging inputs, and the public audit record."
/>

{#snippet step(n: number, title: string, what: string, why: string)}
	<div class="flex items-baseline gap-4">
		<span class="font-mono text-sm text-dim tabular-nums">0{n}</span>
		<h2 class="m-0 text-xl font-semibold tracking-tight">{title}</h2>
	</div>
	<p class="m-0 text-sm leading-relaxed text-mut">
		<b class="font-medium text-fg">What to check.</b>
		{what}
	</p>
	<p class="m-0 text-sm leading-relaxed text-mut">
		<b class="font-medium text-fg">Why it matters.</b>
		{why}
	</p>
{/snippet}

<main class="mx-auto w-full max-w-page px-6">
	<header class="border-b border-line pt-16 pb-10">
		<a class="text-sm text-mut hover:text-fg" href="/">← Back to the results</a>
		<h1 class="mt-6 mb-4 text-4xl font-semibold tracking-tight">Rules &amp; verification</h1>
		<p class="m-0 max-w-2xl text-base leading-relaxed text-mut">
			This contest ran on an open-source engine. The rules, the judging code, and every recorded
			decision are public. The judging inputs were committed as hashes before any entry was judged,
			so anyone can confirm the contest used the published rules and the exact frozen inputs.
		</p>
		<nav class="mt-8 flex flex-wrap gap-2">
			<a class={link} href={RULES_URL} target="_blank" rel="noreferrer">Full rules (rules.md) ↗</a>
			<a class={link} href={VERIFY_URL} target="_blank" rel="noreferrer">
				Verification guide (verification.md) ↗
			</a>
			<a class={link} href={REPO_URL} target="_blank" rel="noreferrer">Source code ↗</a>
		</nav>
	</header>

	<section class="flex flex-col gap-4 border-b border-line py-10">
		{@render step(
			1,
			"The judges and their instructions",
			"Hash the judge prompt templates in the repo and compare them to the hashes below. The three-model panel and its request settings were frozen at the same time.",
			"The entries were judged by exactly the models and instructions published before judging started — nothing was swapped or reworded after seeing the field."
		)}
		<div class="grid gap-2 sm:grid-cols-3">
			{#each v.panel as judge (judge.id)}
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">{judge.id}</span>
					<span class="mt-1 block font-mono text-xs text-fg">{judge.slug}</span>
				</div>
			{/each}
		</div>
		<HashField label="Scoring prompt hash" value={v.scorePromptHash} />
		<HashField label="Comparison prompt hash" value={v.comparePromptHash} />
		{#if v.judgeSettings.length}
			<div class="grid gap-2 sm:grid-cols-2">
				{#each v.judgeSettings as setting (setting.key)}
					<div class="border border-line px-3 py-2.5">
						<span class="block text-[11px] tracking-widest text-dim uppercase">{setting.key}</span>
						<span class="mt-1 block font-mono text-xs text-fg">{setting.value}</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-4 border-b border-line py-10">
		{@render step(
			2,
			"The hidden keywords",
			"Hash the revealed keywords with the revealed salt (the exact formula is in verification.md) and compare it to the commitment below.",
			"The keywords that decided eligibility were fixed before the contest opened, not chosen afterwards to include or exclude anyone."
		)}
		<HashField label="Keyword commitment" value={v.keywordHash} />
		{#if v.revealedKeywords && v.revealedSalt}
			<div class="grid gap-2 sm:grid-cols-2">
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">Revealed keywords</span
					>
					<span class="mt-1 block font-mono text-xs text-fg">{v.revealedKeywords.join(", ")}</span>
				</div>
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">Salt</span>
					<span class="mt-1 block font-mono text-xs break-all text-fg">{v.revealedSalt}</span>
				</div>
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-4 border-b border-line py-10">
		{@render step(
			3,
			"The scored field and seeding",
			"From the published per-judge scores, recompute each entry's score (the mean of its three judge totals, minus any recorded near-duplicate penalty), rank the field, take the top 64, and recompute the seeded-field fingerprint.",
			"The ranking and bracket seeding follow mechanically from the recorded scores — no entry was moved up, dropped, or hand-placed into the bracket."
		)}
		{#if v.similarity}
			<HashField label="Similarity config hash" value={v.similarity.hash} />
			<div class="grid gap-2 sm:grid-cols-3">
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">Embedding model</span>
					<span class="mt-1 block font-mono text-xs text-fg">
						{v.similarity.embeddingModel} · {v.similarity.embeddingDimensions}d
					</span>
				</div>
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">Thresholds</span>
					<span class="mt-1 block font-mono text-xs text-fg">
						{v.similarity.cosineThreshold} cosine / {v.similarity.lexicalThreshold} lexical
					</span>
				</div>
				<div class="border border-line px-3 py-2.5">
					<span class="block text-[11px] tracking-widest text-dim uppercase">Penalty</span>
					<span class="mt-1 block font-mono text-xs text-fg">{v.similarity.penalty}</span>
				</div>
			</div>
			{#if v.similarityFingerprint}
				<HashField label="Similarity fingerprint" value={v.similarityFingerprint} />
			{/if}
		{/if}
		{#if v.bracketFingerprint}
			<HashField label="Bracket fingerprint" value={v.bracketFingerprint} />
		{/if}
	</section>

	<section class="flex flex-col gap-4 border-b border-line py-10">
		{@render step(
			4,
			"The bracket",
			"Open any matchup on the results page and recount its votes: each judge compared the two entries twice (A-first and B-first), a vote only counted if the judge picked the same entry both times, the majority won, and a deadlock went to the higher seed. Repeat down to the final.",
			"The champion follows from the recorded votes alone — no matchup outcome was overridden."
		)}
	</section>

	<section class="flex flex-col gap-4 border-b border-line py-10">
		{@render step(
			5,
			"The complete record",
			"Every check above can be run offline from a single file: the frozen config, the revealed keywords and salt, every captured entry with its disqualification reason, every per-judge rubric score, the full near-duplicate record, and every bracket vote.",
			"Archive it. The record no longer depends on this site, and its hash pins the whole thing."
		)}
		<HashField label="Bundle SHA-256" value={v.bundleSha256} />
		<a
			class="self-start border border-fg bg-fg px-5 py-2.5 text-sm font-medium text-bg hover:bg-bg hover:text-fg"
			href={v.bundleUrl}
			download
		>
			Download the audit bundle ({formatBytes(v.bundleBytes)})
		</a>
		<pre
			class="m-0 overflow-x-auto border border-line bg-panel px-4 py-3 font-mono text-xs text-mut">bun run worker verify --file {data
				.meta.videoId}.json</pre>
		<p class="m-0 text-sm leading-relaxed text-mut">
			The repo ships a first-party checker that runs all six verification.md checks against a
			downloaded bundle with no database or API keys. The independent spec remains verification.md.
		</p>
	</section>

	<p class="mt-8 text-sm leading-relaxed text-dim">
		<b class="font-medium text-mut">On reproducibility:</b> hosted models can change behind a slug, so
		re-running the judges is not promised to give identical scores. What is verifiable is that the published
		result follows from the recorded decisions and the inputs committed before judging.
	</p>

	<SiteFooter fingerprint={v.bracketFingerprint} />
</main>
