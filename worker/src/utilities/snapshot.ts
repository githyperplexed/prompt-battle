import { MAX_ENTRIES } from "$src/constants";
import { classifyComment, countCharacters, type DqReason } from "$src/utilities/validation";

export type SnapshotTiming = "in_window" | "posted_after_cutoff" | "edited_after_cutoff";

export type SnapshotComment = {
	commentId: string;
	channelId: string;
	authorDisplayName: string;
	text: string;
	publishedAt: Date;
	updatedAt: Date;
};

type SnapshotDqReason = DqReason | "duplicate_channel" | "tos" | "edited_after_cutoff";

export type SnapshotEntryRow = {
	contestId: string;
	youtubeCommentId: string;
	channelId: string;
	authorDisplayName: string;
	text: string;
	charCount: number;
	publishedAt: Date;
	updatedAt: Date;
	status: "eligible" | "disqualified";
	dqReason: SnapshotDqReason | null;
};

export type SnapshotRowsResult = {
	comments: SnapshotComment[];
	rows: SnapshotEntryRow[];
	afterCutoff: number;
	eligible: number;
};

export const classifySnapshotTiming = (
	comment: { publishedAt: Date; updatedAt: Date },
	snapshotAt: Date
): SnapshotTiming => {
	if (comment.publishedAt.getTime() > snapshotAt.getTime()) return "posted_after_cutoff";
	if (comment.updatedAt.getTime() > snapshotAt.getTime()) return "edited_after_cutoff";

	return "in_window";
};

export const isSnapshotDue = (snapshotAt: Date, now: Date): boolean =>
	now.getTime() >= snapshotAt.getTime();

export const buildSnapshotRows = ({
	contestId,
	comments,
	snapshotAt,
	keywords,
	excluded,
	flaggedCommentIds,
	maxEntries = MAX_ENTRIES
}: {
	contestId: string;
	comments: SnapshotComment[];
	snapshotAt: Date;
	keywords: string[];
	excluded: Set<string>;
	flaggedCommentIds: Set<string>;
	maxEntries?: number;
}): SnapshotRowsResult => {
	const inScopeComments = comments.filter(
		(comment) => classifySnapshotTiming(comment, snapshotAt) !== "posted_after_cutoff"
	);
	const editedAfterCutoff = new Set(
		inScopeComments
			.filter((comment) => classifySnapshotTiming(comment, snapshotAt) === "edited_after_cutoff")
			.map((comment) => comment.commentId)
	);

	inScopeComments.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

	const countedChannels = new Set<string>();
	const rows: SnapshotEntryRow[] = [];
	let eligible = 0;

	for (const comment of inScopeComments) {
		let status: "eligible" | "disqualified";
		let reason: SnapshotEntryRow["dqReason"] = null;

		if (flaggedCommentIds.has(comment.commentId)) {
			status = "disqualified";
			reason = "tos";
		} else if (editedAfterCutoff.has(comment.commentId)) {
			status = "disqualified";
			reason = "edited_after_cutoff";
		} else {
			const verdict = classifyComment(comment, { keywords, excluded });

			if (!verdict.eligible) {
				status = "disqualified";
				reason = verdict.reason;
			} else if (countedChannels.has(comment.channelId)) {
				status = "disqualified";
				reason = "duplicate_channel";
			} else if (eligible >= maxEntries) {
				continue;
			} else {
				status = "eligible";
				countedChannels.add(comment.channelId);
				eligible += 1;
			}
		}

		rows.push({
			contestId,
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

	return {
		comments: inScopeComments,
		rows,
		afterCutoff: comments.length - inScopeComments.length,
		eligible
	};
};
