export type SnapshotTiming = "in_window" | "posted_after_cutoff" | "edited_after_cutoff";

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
