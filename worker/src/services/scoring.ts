import Bottleneck from "bottleneck";

import { and, contest, db, entry, eq, score } from "@prompt-battle/db";

import {
	parseContestConfig,
	type ContestConfig,
	type JudgeRequestSettings,
	type PromptTemplate
} from "$src/utilities/contest-config";
import { withRefusalConfirmation } from "$src/utilities/judge";
import {
	auditScoreCoverage,
	buildWorkList,
	exceedsUnscorableGuardrail
} from "$src/utilities/scoring";
import { scoreEntry } from "$src/services/judge";
import { withContestLock } from "$src/services/locks";

// ≤10 in flight, and a new request started at most every 200ms (5 req/s).
const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });

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
	const outcome = await withRefusalConfirmation(() =>
		scoreEntry(model.slug, item.text, prompt, requestSettings, {
			functionId: "score-entry",
			metadata: { contestId, entryId: item.id, modelId: model.id }
		})
	);

	if (outcome.refused) return { outcome: "unscorable", detail: `${model.id}: ${outcome.detail}` };

	const { score: result, nonce, audit } = outcome.value;

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
};

// Automated disqualification, so dqNote stays null (a non-null note marks a hand-issued removal).
// The machine-recorded justification — which model(s) refused and the final error — goes in
// dqEvidence so it outlives telemetry retention.
const markUnscorable = async (contestId: string, unscorable: Map<string, string[]>) => {
	for (const [entryId, details] of unscorable) {
		await db
			.update(entry)
			.set({ status: "disqualified", dqReason: "unscorable", dqEvidence: details.join("; ") })
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
	const unscorable = new Map<string, string[]>();

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

					if (result.outcome === "scored") {
						completed += 1;
					} else {
						const details = unscorable.get(item.entry.id) ?? [];
						details.push(result.detail);
						unscorable.set(item.entry.id, details);
					}
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

export const scoreContest = async (
	contestId: string,
	{ allowUnscorable }: { allowUnscorable?: number } = {}
) =>
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

		// Guardrail: refusals this widespread are a systemic failure, not entry-level evidence, so
		// the run disqualifies nothing — entries stay eligible, every refused pair stays retryable,
		// and the coverage gate below keeps the contest in `scoring`. An operator who reviewed the
		// reported refusals can raise the threshold for this run via allowUnscorable.
		const suppressed = exceedsUnscorableGuardrail(unscorable.size, entries.length, allowUnscorable);

		if (!suppressed && unscorable.size > 0) await markUnscorable(contestId, unscorable);

		// Unscorable entries are now disqualified, so they are excluded from the coverage that
		// gates the `scored` flip — one entry a model refuses can't hold the contest open.
		const remaining = suppressed ? entries : entries.filter((e) => !unscorable.has(e.id));
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
			eligible: entries.length,
			unscorable: [...unscorable.entries()].map(([entryId, details]) => ({
				entryId,
				detail: details.join("; ")
			})),
			unscorableSuppressed: suppressed,
			complete: coverage.complete,
			missing: coverage.missing,
			unexpected: coverage.unexpected
		};
	});
