import { count, db, entry, eq, matchup, score } from "@prompt-battle/db";

import { BRACKET_SIZE } from "$src/constants";
import { isSnapshotDue } from "$src/utilities/snapshot";
import { nextStep, type ContestSummary, type StatusReport } from "$src/utilities/status";

type ConfigShape = {
	panel?: { id: string }[];
	keywordHash?: string;
	prompts?: { score?: { hash?: string }; compare?: { hash?: string } };
	similarity?: { hash?: string };
};

export const listContestSummaries = async (): Promise<ContestSummary[]> => {
	const rows = await db.query.contest.findMany({
		orderBy: (c, { desc }) => desc(c.createdAt),
		columns: { id: true, videoId: true, status: true, winnerEntryId: true }
	});

	return rows.map((r) => ({
		id: r.id,
		videoId: r.videoId,
		status: r.status,
		hasWinner: !!r.winnerEntryId
	}));
};

export const loadStatusReport = async (contestId: string): Promise<StatusReport | null> => {
	const c = await db.query.contest.findFirst({ where: (x, { eq }) => eq(x.id, contestId) });

	if (!c) return null;

	const config = (c.config ?? null) as ConfigShape | null;
	const panel = config?.panel?.map((model) => model.id) ?? [];
	const reached = (...statuses: string[]) => statuses.includes(c.status);
	const publishedNow = !!c.resultsPublishedAt && c.resultsPublishedAt.getTime() <= Date.now();

	let field: StatusReport["field"] = null;

	if (reached("snapshotted", "scoring", "scored", "complete")) {
		const rows = await db
			.select({ status: entry.status, dqReason: entry.dqReason, n: count() })
			.from(entry)
			.where(eq(entry.contestId, contestId))
			.groupBy(entry.status, entry.dqReason);

		let total = 0;
		let eligible = 0;
		let disqualified = 0;
		const dq: { reason: string; count: number }[] = [];

		for (const r of rows) {
			total += r.n;

			if (r.status === "eligible") {
				eligible += r.n;
			} else {
				disqualified += r.n;
				if (r.dqReason) dq.push({ reason: r.dqReason, count: r.n });
			}
		}

		dq.sort((a, b) => b.count - a.count);
		field = { total, eligible, disqualified, dq };
	}

	let scoring: StatusReport["scoring"] = null;

	if (field && reached("scoring", "scored", "complete")) {
		const rows = await db
			.select({ modelId: score.modelId, n: count() })
			.from(score)
			.where(eq(score.contestId, contestId))
			.groupBy(score.modelId);

		const byModel = new Map(rows.map((r) => [r.modelId, r.n]));
		const done = rows.reduce((sum, r) => sum + r.n, 0);
		const expected = field.eligible * panel.length;

		scoring = {
			done,
			expected,
			perModel: panel.map((id) => ({ id, done: byModel.get(id) ?? 0 })),
			complete: expected > 0 && done === expected
		};
	}

	let bracket: StatusReport["bracket"] = null;

	if (reached("scored", "complete")) {
		const counted = await db
			.select({ n: count() })
			.from(matchup)
			.where(eq(matchup.contestId, contestId));

		let winner: { author: string; score: number; seed: number | null } | null = null;

		if (c.winnerEntryId) {
			const w = await db.query.entry.findFirst({
				where: (e, { eq }) => eq(e.id, c.winnerEntryId!),
				columns: { authorDisplayName: true, absoluteScore: true, seed: true }
			});

			if (w) winner = { author: w.authorDisplayName, score: w.absoluteScore ?? 0, seed: w.seed };
		}

		// Byes create no matchup rows, so a seeded field of N entrants produces N - 1 matchups.
		const entrants = Math.min(field?.eligible ?? 0, BRACKET_SIZE);

		bracket = {
			matchups: counted[0]?.n ?? 0,
			expected: Math.max(entrants - 1, 0),
			winner,
			fingerprint: c.bracketFingerprint,
			// Published means publicly visible now — a scheduled future publish is still embargoed.
			published: publishedNow
		};
	}

	return {
		id: c.id,
		videoId: c.videoId,
		status: c.status,
		createdAt: c.createdAt.toISOString(),
		snapshotAt: c.snapshotAt.toISOString(),
		capturedAt: c.capturedAt?.toISOString() ?? null,
		resultsPublishedAt: c.resultsPublishedAt?.toISOString() ?? null,
		snapshotDue: c.status === "open" ? isSnapshotDue(c.snapshotAt, new Date()) : null,
		panel,
		scorePromptHash: config?.prompts?.score?.hash ?? "—",
		comparePromptHash: config?.prompts?.compare?.hash ?? "—",
		keywordHash: config?.keywordHash ?? "—",
		similarityHash: config?.similarity?.hash ?? "—",
		similarityComputedAt: c.similarityComputedAt?.toISOString() ?? null,
		similarityFingerprint: c.similarityFingerprint,
		field,
		scoring,
		bracket,
		next: nextStep(c.status, publishedNow)
	};
};
