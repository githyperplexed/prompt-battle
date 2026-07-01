import { and, contest, db, entry, eq, inArray, sql } from "@prompt-battle/db";

import { withContestLock } from "$src/services/locks";

// Manual DQ is restricted to the two operator-judgment reasons the rules already contemplate:
// affiliated accounts (rules §3) and TOS violations removed before judging (rules §3). The
// mechanical reasons stay computed at ingest and are never applied by hand.
type ManualDqReason = "affiliated" | "tos";

export type DqSelector = { by: "channel"; ids: string[] } | { by: "comment"; ids: string[] };

// Disqualifies the selected eligible entries. Only valid while the contest is `snapshotted` —
// scoring reads eligible rows, so flipping them here removes entries with no downstream recompute;
// once scoring has begun the caller must reset to snapshotted first.
export const disqualifyEntries = async (
	contestId: string,
	reason: ManualDqReason,
	selector: DqSelector,
	note: string
) =>
	withContestLock(contestId, () =>
		db.transaction(async (tx) => {
			await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

			const found = await tx.query.contest.findFirst({
				where: (c, { eq }) => eq(c.id, contestId),
				columns: { id: true, status: true }
			});

			if (!found) throw new Error(`No contest with id ${contestId}`);

			if (found.status !== "snapshotted") return { skipped: true as const, status: found.status };

			const column = selector.by === "channel" ? entry.channelId : entry.youtubeCommentId;

			const updated = await tx
				.update(entry)
				.set({ status: "disqualified", dqReason: reason, dqNote: note })
				.where(
					and(
						eq(entry.contestId, contestId),
						eq(entry.status, "eligible"),
						inArray(column, selector.ids)
					)
				)
				.returning({ channelId: entry.channelId, commentId: entry.youtubeCommentId });

			const matched = new Set(
				updated.map((row) => (selector.by === "channel" ? row.channelId : row.commentId))
			);

			return { skipped: false as const, count: updated.length, matched: [...matched] };
		})
	);
