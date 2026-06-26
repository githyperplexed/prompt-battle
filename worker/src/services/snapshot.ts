import { contest, db, entry, eq, sql } from "@prompt-battle/db";

import { parseContestConfig } from "$src/utilities/contest-config";
import { matchesKeywordHash } from "$src/utilities/keywords";
import { buildSnapshotRows, isSnapshotDue, type SnapshotEntryRow } from "$src/utilities/snapshot";
import { resolveExcludedChannels } from "$src/services/excluded";
import { flagViolations } from "$src/services/moderation";
import { loadKeywordSecret } from "$src/services/secrets";
import { fetchAllComments } from "$src/services/youtube";

type EntryInsert = typeof entry.$inferInsert;

const CHUNK = 1000;

const toEntryInsert = (row: SnapshotEntryRow): EntryInsert => row;

const commitSnapshotRows = async ({
	contestId,
	rows,
	capturedAt
}: {
	contestId: string;
	rows: EntryInsert[];
	capturedAt: Date;
}) =>
	db.transaction(async (tx) => {
		await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

		const locked = await tx.query.contest.findFirst({
			where: (c, { eq }) => eq(c.id, contestId)
		});

		if (!locked) throw new Error(`No contest with id ${contestId}`);

		if (locked.status !== "open") {
			return { skipped: true as const, status: locked.status };
		}

		await tx.delete(entry).where(eq(entry.contestId, contestId));

		for (let i = 0; i < rows.length; i += CHUNK) {
			await tx.insert(entry).values(rows.slice(i, i + CHUNK));
		}

		await tx
			.update(contest)
			.set({ status: "snapshotted", capturedAt })
			.where(eq(contest.id, contestId));

		return { skipped: false as const };
	});

export const snapshotContest = async (
	contestId: string,
	options: { maxEntries?: number; maxComments?: number; skipModeration?: boolean } = {}
) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId)
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	if (target.status !== "open") {
		return { skipped: true as const, status: target.status };
	}

	const config = parseContestConfig(target.config);
	const capturedAt = new Date();

	if (!isSnapshotDue(target.snapshotAt, capturedAt)) {
		throw new Error(
			"Contest " + contestId + " is not due until " + target.snapshotAt.toISOString()
		);
	}

	const secret = loadKeywordSecret(target.videoId);

	if (!matchesKeywordHash(secret.keywords, secret.salt, config.keywordHash)) {
		throw new Error("Keyword secret does not match the commitment stored for contest " + contestId);
	}

	const excluded = await resolveExcludedChannels();
	const fetched = await fetchAllComments(target.videoId, { maxComments: options.maxComments });

	if (!fetched.complete) {
		throw new Error(
			`YouTube comment history exceeded the ${fetched.maxComments} comment fetch cap for contest ${contestId}; snapshot is incomplete and cannot be frozen.`
		);
	}

	const comments = fetched.comments;
	const flagged = new Set<string>();

	// Testing escape hatch (--skip-moderation): leaves `flagged` empty, so no entry is
	// disqualified as `tos`. Production runs always moderate.
	if (!options.skipModeration) {
		const moderationCandidates = comments.filter(
			(comment) => comment.publishedAt.getTime() <= target.snapshotAt.getTime()
		);
		const flags = await flagViolations(moderationCandidates.map((c) => c.text));

		moderationCandidates.forEach((comment, i) => {
			if (flags[i]) flagged.add(comment.commentId);
		});
	}

	const prepared = buildSnapshotRows({
		contestId: target.id,
		comments,
		snapshotAt: target.snapshotAt,
		keywords: secret.keywords,
		excluded,
		flaggedCommentIds: flagged,
		maxEntries: options.maxEntries
	});
	const rows = prepared.rows.map(toEntryInsert);
	const commit = await commitSnapshotRows({ contestId: target.id, rows, capturedAt });

	if (commit.skipped) return commit;

	return {
		skipped: false as const,
		total: comments.length,
		afterCutoff: prepared.afterCutoff,
		unique: prepared.unique,
		stored: rows.length,
		eligible: prepared.eligible
	};
};

export const snapshotDueContests = async (
	options: { maxEntries?: number; maxComments?: number; skipModeration?: boolean } = {}
) => {
	const due = await db.query.contest.findMany({
		where: (c, { and, eq, lte }) => and(eq(c.status, "open"), lte(c.snapshotAt, new Date())),
		columns: { id: true }
	});

	const results = [];

	for (const d of due) {
		results.push({ id: d.id, ...(await snapshotContest(d.id, options)) });
	}

	return results;
};
