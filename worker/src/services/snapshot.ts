import { contest, db, entry, eq } from "@prompt-battle/db";

import { MAX_ENTRIES } from "$src/constants";
import { classifySnapshotTiming, isSnapshotDue } from "$src/utilities/snapshot";
import { classifyComment, countCharacters } from "$src/utilities/validation";
import { resolveExcludedChannels } from "$src/services/excluded";
import { flagViolations } from "$src/services/moderation";
import { loadKeywordSecret } from "$src/services/secrets";
import { fetchAllComments } from "$src/services/youtube";

type EntryInsert = typeof entry.$inferInsert;

const CHUNK = 1000;

export const snapshotContest = async (contestId: string) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId)
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	if (target.status !== "open") {
		return { skipped: true as const, status: target.status };
	}

	const capturedAt = new Date();

	if (!isSnapshotDue(target.snapshotAt, capturedAt)) {
		throw new Error(
			"Contest " + contestId + " is not due until " + target.snapshotAt.toISOString()
		);
	}

	const secret = loadKeywordSecret(target.videoId);
	const excluded = await resolveExcludedChannels();
	const fetched = await fetchAllComments(target.videoId);
	const comments = fetched.filter(
		(comment) => classifySnapshotTiming(comment, target.snapshotAt) !== "posted_after_cutoff"
	);
	const editedAfterCutoff = new Set(
		comments
			.filter(
				(comment) => classifySnapshotTiming(comment, target.snapshotAt) === "edited_after_cutoff"
			)
			.map((comment) => comment.commentId)
	);

	// Earliest first: drives "first eligible per channel" and "first 10k by timestamp".
	comments.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

	const flags = await flagViolations(comments.map((c) => c.text));
	const flagged = new Set<string>();

	comments.forEach((c, i) => {
		if (flags[i]) flagged.add(c.commentId);
	});

	const countedChannels = new Set<string>();
	const rows: EntryInsert[] = [];

	let eligible = 0;

	for (const comment of comments) {
		let status: "eligible" | "disqualified";
		let reason: EntryInsert["dqReason"] = null;

		// Content-policy violations take precedence so flagged text never advances or counts.
		if (flagged.has(comment.commentId)) {
			status = "disqualified";
			reason = "tos";
		} else if (editedAfterCutoff.has(comment.commentId)) {
			status = "disqualified";
			reason = "edited_after_cutoff";
		} else {
			const verdict = classifyComment(comment, { keywords: secret.keywords, excluded });

			if (!verdict.eligible) {
				status = "disqualified";
				reason = verdict.reason;
			} else if (countedChannels.has(comment.channelId)) {
				status = "disqualified";
				reason = "duplicate_channel";
			} else if (eligible >= MAX_ENTRIES) {
				continue;
			} else {
				status = "eligible";
				countedChannels.add(comment.channelId);
				eligible += 1;
			}
		}

		rows.push({
			contestId: target.id,
			youtubeCommentId: comment.commentId,
			channelId: comment.channelId,
			authorDisplayName: comment.authorDisplayName,
			text: comment.text,
			charCount: countCharacters(comment.text),
			publishedAt: comment.publishedAt,
			updatedAt: comment.updatedAt,
			status,
			dqReason: reason
		});
	}

	// onConflictDoNothing keeps the snapshot immutable on re-runs (idempotent for cron).
	for (let i = 0; i < rows.length; i += CHUNK) {
		await db
			.insert(entry)
			.values(rows.slice(i, i + CHUNK))
			.onConflictDoNothing();
	}

	await db
		.update(contest)
		.set({ status: "snapshotted", capturedAt })
		.where(eq(contest.id, target.id));

	return {
		skipped: false as const,
		total: fetched.length,
		afterCutoff: fetched.length - comments.length,
		stored: rows.length,
		eligible
	};
};

export const snapshotDueContests = async () => {
	const due = await db.query.contest.findMany({
		where: (c, { and, eq, lte }) => and(eq(c.status, "open"), lte(c.snapshotAt, new Date())),
		columns: { id: true }
	});

	const results = [];

	for (const d of due) {
		results.push({ id: d.id, ...(await snapshotContest(d.id)) });
	}

	return results;
};
