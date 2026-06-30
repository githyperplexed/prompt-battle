import Bottleneck from "bottleneck";

import { contest, db, eq, score } from "@prompt-battle/db";

import {
	parseContestConfig,
	type ContestConfig,
	type JudgeRequestSettings,
	type PromptTemplate
} from "$src/utilities/contest-config";
import { auditScoreCoverage, buildWorkList } from "$src/utilities/scoring";
import { scoreEntry } from "$src/services/judge";
import { withContestLock } from "$src/services/locks";

// ≤10 in flight, and a new request started at most every 200ms (5 req/s).
const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });

type Entry = { id: string; text: string };
type Model = ContestConfig["panel"][number];

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
	entry: Entry,
	model: Model,
	prompt: PromptTemplate,
	requestSettings: JudgeRequestSettings
) => {
	const {
		score: result,
		nonce,
		audit
	} = await scoreEntry(model.slug, entry.text, prompt, requestSettings, {
		functionId: "score-entry",
		metadata: { contestId, entryId: entry.id, modelId: model.id }
	});

	await db
		.insert(score)
		.values({
			contestId,
			entryId: entry.id,
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
};

const runScoring = async (
	contestId: string,
	work: { entry: Entry; model: Model }[],
	prompt: PromptTemplate,
	requestSettings: JudgeRequestSettings
) => {
	let completed = 0;
	let failed = 0;

	await Promise.all(
		work.map((item) =>
			limiter.schedule(async () => {
				try {
					await scoreAndStore(contestId, item.entry, item.model, prompt, requestSettings);
					completed += 1;
				} catch (err) {
					failed += 1;
					const message = err instanceof Error ? err.message : String(err);
					console.warn(`Score failed (entry ${item.entry.id}, model ${item.model.id}): ${message}`);
				}
			})
		)
	);

	await limiter.disconnect();

	return { completed, failed };
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

		const { completed, failed } = await runScoring(
			contestId,
			work,
			target.config.prompts.score,
			target.config.judge.requestSettings
		);
		const coverage = auditScoreCoverage(
			entries,
			target.config.panel,
			await loadScoredPairs(contestId)
		);

		if (coverage.complete) await markScored(contestId);

		return {
			skipped: false as const,
			total: work.length,
			completed,
			failed,
			complete: coverage.complete,
			missing: coverage.missing,
			unexpected: coverage.unexpected
		};
	});
