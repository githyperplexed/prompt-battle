import Bottleneck from "bottleneck";

import { contest, db, eq, score } from "@prompt-battle/db";

import { panel } from "../config";
import { buildWorkList } from "../utilities/scoring";
import { scoreEntry } from "./judge";

// ≤10 in flight, and a new request started at most every 200ms (5 req/s).
const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });

type Entry = { id: string; text: string };
type Model = (typeof panel)[number];

const loadContest = async (contestId: string) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { id: true, status: true }
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	return target;
};

const loadEligibleEntries = (contestId: string) =>
	db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, text: true }
	});

const loadScoredPairs = async (contestId: string): Promise<Set<string>> => {
	const rows = await db
		.select({ entryId: score.entryId, modelId: score.modelId })
		.from(score)
		.where(eq(score.contestId, contestId));

	return new Set(rows.map((row) => `${row.entryId}:${row.modelId}`));
};

const markScoring = (contestId: string) =>
	db.update(contest).set({ status: "scoring" }).where(eq(contest.id, contestId));

const scoreAndStore = async (contestId: string, entry: Entry, model: Model) => {
	const { score: result, nonce } = await scoreEntry(model.slug, entry.text);

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
			nonce
		})
		.onConflictDoNothing();
};

const runScoring = async (contestId: string, work: { entry: Entry; model: Model }[]) => {
	let completed = 0;
	let failed = 0;

	await Promise.all(
		work.map((item) =>
			limiter.schedule(async () => {
				try {
					await scoreAndStore(contestId, item.entry, item.model);
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

export const scoreContest = async (contestId: string) => {
	const target = await loadContest(contestId);

	if (target.status !== "snapshotted" && target.status !== "scoring") {
		return { skipped: true as const, status: target.status };
	}

	const entries = await loadEligibleEntries(contestId);
	const done = await loadScoredPairs(contestId);
	const work = buildWorkList(entries, panel, done);

	await markScoring(contestId);

	const { completed, failed } = await runScoring(contestId, work);

	return { skipped: false as const, total: work.length, completed, failed };
};
