import Bottleneck from "bottleneck";

import { and, contest, db, entry, eq, score } from "@prompt-battle/db";

import {
	parseContestConfig,
	type ContestConfig,
	type JudgeRequestSettings,
	type PromptTemplate
} from "$src/utilities/contest-config";
import { auditScoreCoverage, buildWorkList, isNoOutputError } from "$src/utilities/scoring";
import { scoreEntry } from "$src/services/judge";
import { withContestLock } from "$src/services/locks";

// ≤10 in flight, and a new request started at most every 200ms (5 req/s).
const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });

// A model that returns no schema-valid output this many times in a row for one entry is treated
// as a genuine refusal (the entry becomes unscorable), not a one-off fluke. Transient/network
// failures never reach this loop — they rethrow on the first attempt and stay retryable.
const REFUSAL_CONFIRMATIONS = 3;

type Entry = { id: string; text: string };
type Model = ContestConfig["panel"][number];
type ScoreOutcome = { outcome: "scored" } | { outcome: "unscorable"; detail: string };

const loadContest = async (contestId: string) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { id: true, status: true, config: true }
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	return { ...target, config: parseContestConfig(target.config) };
};

const loadEligibleEntries = (contestId: string) =>
	db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, text: true }
	});

const loadScoredPairs = (contestId: string) =>
	db
		.select({ entryId: score.entryId, modelId: score.modelId })
		.from(score)
		.where(eq(score.contestId, contestId));

const markScoring = (contestId: string) =>
	db.update(contest).set({ status: "scoring" }).where(eq(contest.id, contestId));

const markScored = (contestId: string) =>
	db.update(contest).set({ status: "scored" }).where(eq(contest.id, contestId));

const scoreAndStore = async (
	contestId: string,
	item: Entry,
	model: Model,
	prompt: PromptTemplate,
	requestSettings: JudgeRequestSettings
): Promise<ScoreOutcome> => {
	let lastDetail = "";

	// A no-output error repeats deterministically for a real refusal, so a few confirmations
	// separate that from a rare fluke. Any other error type bubbles up as a transient failure.
	for (let attempt = 1; attempt <= REFUSAL_CONFIRMATIONS; attempt += 1) {
		try {
			const {
				score: result,
				nonce,
				audit
			} = await scoreEntry(model.slug, item.text, prompt, requestSettings, {
				functionId: "score-entry",
				metadata: { contestId, entryId: item.id, modelId: model.id }
			});

			await db
				.insert(score)
				.values({
					contestId,
					entryId: item.id,
					modelId: model.id,
					persuasiveness: result.persuasiveness,
					originality: result.originality,
					cleverness: result.cleverness,
					execution: result.execution,
					total: result.persuasiveness + result.originality + result.cleverness + result.execution,
					nonce,
					audit
				})
				.onConflictDoNothing();

			return { outcome: "scored" };
		} catch (err) {
			if (!isNoOutputError(err)) throw err;

			lastDetail = err instanceof Error ? err.message : String(err);
		}
	}

	return { outcome: "unscorable", detail: `${model.id}: ${lastDetail}` };
};

// Automated disqualification, so dqNote stays null (a non-null note marks a hand-issued removal).
const markUnscorable = async (contestId: string, entryIds: Iterable<string>) => {
	for (const entryId of entryIds) {
		await db
			.update(entry)
			.set({ status: "disqualified", dqReason: "unscorable" })
			.where(
				and(eq(entry.contestId, contestId), eq(entry.id, entryId), eq(entry.status, "eligible"))
			);
	}
};

const runScoring = async (
	contestId: string,
	work: { entry: Entry; model: Model }[],
	prompt: PromptTemplate,
	requestSettings: JudgeRequestSettings
) => {
	let completed = 0;
	let failed = 0;
	const unscorable = new Map<string, string>();

	await Promise.all(
		work.map((item) =>
			limiter.schedule(async () => {
				try {
					const result = await scoreAndStore(
						contestId,
						item.entry,
						item.model,
						prompt,
						requestSettings
					);

					if (result.outcome === "scored") completed += 1;
					else unscorable.set(item.entry.id, result.detail);
				} catch (err) {
					failed += 1;
					const message = err instanceof Error ? err.message : String(err);
					console.warn(`Score failed (entry ${item.entry.id}, model ${item.model.id}): ${message}`);
				}
			})
		)
	);

	await limiter.disconnect();

	return { completed, failed, unscorable };
};

export const scoreContest = async (contestId: string) =>
	withContestLock(contestId, async () => {
		const target = await loadContest(contestId);

		if (target.status !== "snapshotted" && target.status !== "scoring") {
			return { skipped: true as const, status: target.status };
		}

		const entries = await loadEligibleEntries(contestId);
		const scored = await loadScoredPairs(contestId);
		const done = new Set(scored.map((row) => row.entryId + ":" + row.modelId));
		const work = buildWorkList(entries, target.config.panel, done);

		await markScoring(contestId);

		const { completed, failed, unscorable } = await runScoring(
			contestId,
			work,
			target.config.prompts.score,
			target.config.judge.requestSettings
		);

		if (unscorable.size > 0) await markUnscorable(contestId, unscorable.keys());

		// Unscorable entries are now disqualified, so they are excluded from the coverage that
		// gates the `scored` flip — one entry a model refuses can't hold the contest open.
		const remaining = entries.filter((e) => !unscorable.has(e.id));
		const coverage = auditScoreCoverage(
			remaining,
			target.config.panel,
			await loadScoredPairs(contestId)
		);

		if (coverage.complete) await markScored(contestId);

		return {
			skipped: false as const,
			total: work.length,
			completed,
			failed,
			unscorable: [...unscorable.entries()].map(([entryId, detail]) => ({ entryId, detail })),
			complete: coverage.complete,
			missing: coverage.missing,
			unexpected: coverage.unexpected
		};
	});
