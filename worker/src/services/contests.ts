import { contest, db, entry, eq, matchup, score, sql } from "@prompt-battle/db";

import { canResetTo, type ResetTarget } from "$src/utilities/contest-status";
import { withContestLock } from "$src/services/locks";

type CreateContestInput = {
	videoId: string;
	videoPublishedAt: Date;
	snapshotAt: Date;
	config: Record<string, unknown>;
};

export const createContest = async (input: CreateContestInput) => {
	const existing = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.videoId, input.videoId),
		columns: { id: true }
	});

	if (existing) {
		throw new Error(`A contest already exists for video ${input.videoId} (id ${existing.id})`);
	}

	const [row] = await db
		.insert(contest)
		.values({
			videoId: input.videoId,
			videoPublishedAt: input.videoPublishedAt,
			snapshotAt: input.snapshotAt,
			status: "open",
			config: input.config
		})
		.returning();

	if (!row) throw new Error("Failed to create contest");

	return row;
};

// All four are materialized by `advance` (rank/seed/absoluteScore via persistRankings,
// finalRound via finalize), never by `score`. A freshly-scored contest has them null, so any
// reset to `scored` or earlier clears them; the raw per-model scores live in the `score` table,
// which these resets keep.
const clearRankingColumns = { absoluteScore: null, rank: null, seed: null, finalRound: null };

// Unwinds a contest to an earlier stage, deleting everything produced after it. Matchups are
// deleted before entries because matchup/comparison reference entries without ON DELETE
// CASCADE; deleting matchups first cascades comparisons and frees those references.
export const resetContest = async (contestId: string, to: ResetTarget) =>
	withContestLock(contestId, () =>
		db.transaction(async (tx) => {
			await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

			const found = await tx.query.contest.findFirst({
				where: (c, { eq }) => eq(c.id, contestId),
				columns: { id: true, status: true }
			});

			if (!found) throw new Error(`No contest with id ${contestId}`);

			if (!canResetTo(found.status, to)) {
				return { skipped: true as const, status: found.status };
			}

			await tx.delete(matchup).where(eq(matchup.contestId, contestId));

			if (to === "open") {
				await tx.delete(score).where(eq(score.contestId, contestId));
				await tx.delete(entry).where(eq(entry.contestId, contestId));
				await tx
					.update(contest)
					.set({ status: "open", capturedAt: null, winnerEntryId: null, bracketFingerprint: null })
					.where(eq(contest.id, contestId));
			} else if (to === "snapshotted") {
				await tx.delete(score).where(eq(score.contestId, contestId));
				await tx.update(entry).set(clearRankingColumns).where(eq(entry.contestId, contestId));
				await tx
					.update(contest)
					.set({ status: "snapshotted", winnerEntryId: null, bracketFingerprint: null })
					.where(eq(contest.id, contestId));
			} else {
				await tx.update(entry).set(clearRankingColumns).where(eq(entry.contestId, contestId));
				await tx
					.update(contest)
					.set({ status: "scored", winnerEntryId: null, bracketFingerprint: null })
					.where(eq(contest.id, contestId));
			}

			return { skipped: false as const, from: found.status, to };
		})
	);

export const deleteContest = async (contestId: string) =>
	withContestLock(contestId, () =>
		db.transaction(async (tx) => {
			await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

			const found = await tx.query.contest.findFirst({
				where: (c, { eq }) => eq(c.id, contestId),
				columns: { id: true }
			});

			if (!found) throw new Error(`No contest with id ${contestId}`);

			await tx.delete(matchup).where(eq(matchup.contestId, contestId));
			await tx.delete(score).where(eq(score.contestId, contestId));
			await tx.delete(entry).where(eq(entry.contestId, contestId));
			await tx.delete(contest).where(eq(contest.id, contestId));

			return { deleted: true as const };
		})
	);

// Sets (or clears, when `at` is null) the results-publish timestamp that lifts the web
// embargo. Publishing requires a finished field; unpublishing is always allowed.
export const publishContest = async (contestId: string, at: Date | null) =>
	db.transaction(async (tx) => {
		await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

		const found = await tx.query.contest.findFirst({
			where: (c, { eq }) => eq(c.id, contestId),
			columns: { id: true, status: true }
		});

		if (!found) throw new Error(`No contest with id ${contestId}`);

		if (at !== null && found.status !== "scored" && found.status !== "complete") {
			return { skipped: true as const, status: found.status };
		}

		await tx.update(contest).set({ resultsPublishedAt: at }).where(eq(contest.id, contestId));

		return { skipped: false as const, status: found.status, publishedAt: at };
	});
