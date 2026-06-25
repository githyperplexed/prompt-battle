import { describe, expect, test } from "bun:test";

import {
	buildSnapshotRows,
	classifySnapshotTiming,
	isSnapshotDue,
	type SnapshotComment
} from "../src/utilities/snapshot";

const cutoff = new Date("2026-06-24T12:00:00.000Z");
const before = new Date("2026-06-24T11:59:59.999Z");
const after = new Date("2026-06-24T12:00:00.001Z");
const validText = "alpha beta this entry is long enough to satisfy minimum length";

const comment = (overrides: Partial<SnapshotComment>): SnapshotComment => ({
	commentId: "comment-1",
	channelId: "channel-1",
	authorDisplayName: "Player One",
	text: validText,
	publishedAt: before,
	updatedAt: before,
	...overrides
});

describe("snapshot cutoff", () => {
	test("rejects capture before the cutoff and allows it exactly at the cutoff", () => {
		expect(isSnapshotDue(cutoff, before)).toBe(false);
		expect(isSnapshotDue(cutoff, cutoff)).toBe(true);
		expect(isSnapshotDue(cutoff, after)).toBe(true);
	});

	test("keeps comments published and edited before the cutoff", () => {
		expect(classifySnapshotTiming({ publishedAt: before, updatedAt: before }, cutoff)).toBe(
			"in_window"
		);
	});

	test("keeps comments published and edited exactly at the cutoff", () => {
		expect(classifySnapshotTiming({ publishedAt: cutoff, updatedAt: cutoff }, cutoff)).toBe(
			"in_window"
		);
		expect(classifySnapshotTiming({ publishedAt: before, updatedAt: cutoff }, cutoff)).toBe(
			"in_window"
		);
	});

	test("discards comments published after the cutoff", () => {
		expect(classifySnapshotTiming({ publishedAt: after, updatedAt: after }, cutoff)).toBe(
			"posted_after_cutoff"
		);
	});

	test("disqualifies comments edited after the cutoff", () => {
		expect(classifySnapshotTiming({ publishedAt: before, updatedAt: after }, cutoff)).toBe(
			"edited_after_cutoff"
		);
	});
});

describe("snapshot row building", () => {
	test("sorts comments oldest first before choosing the first eligible channel entry", () => {
		const result = buildSnapshotRows({
			contestId: "contest-1",
			comments: [
				comment({ commentId: "newer", publishedAt: cutoff, updatedAt: cutoff }),
				comment({ commentId: "older", publishedAt: before, updatedAt: before })
			],
			snapshotAt: cutoff,
			keywords: ["alpha", "beta"],
			excluded: new Set(),
			flaggedCommentIds: new Set()
		});

		expect(result.eligible).toBe(1);
		expect(result.rows.map((row) => [row.youtubeCommentId, row.status, row.dqReason])).toEqual([
			["older", "eligible", null],
			["newer", "disqualified", "duplicate_channel"]
		]);
	});

	test("does not store comments published after the cutoff", () => {
		const result = buildSnapshotRows({
			contestId: "contest-1",
			comments: [
				comment({ commentId: "kept" }),
				comment({ commentId: "late", publishedAt: after, updatedAt: after })
			],
			snapshotAt: cutoff,
			keywords: ["alpha", "beta"],
			excluded: new Set(),
			flaggedCommentIds: new Set()
		});

		expect(result.afterCutoff).toBe(1);
		expect(result.rows.map((row) => row.youtubeCommentId)).toEqual(["kept"]);
	});

	test("stores post-cutoff edits as disqualified rows", () => {
		const result = buildSnapshotRows({
			contestId: "contest-1",
			comments: [comment({ updatedAt: after })],
			snapshotAt: cutoff,
			keywords: ["alpha", "beta"],
			excluded: new Set(),
			flaggedCommentIds: new Set()
		});

		expect(result.rows[0]?.status).toBe("disqualified");
		expect(result.rows[0]?.dqReason).toBe("edited_after_cutoff");
	});

	test("content policy flags take precedence over other disqualification reasons", () => {
		const result = buildSnapshotRows({
			contestId: "contest-1",
			comments: [comment({ commentId: "flagged", updatedAt: after })],
			snapshotAt: cutoff,
			keywords: ["alpha", "beta"],
			excluded: new Set(),
			flaggedCommentIds: new Set(["flagged"])
		});

		expect(result.rows[0]?.status).toBe("disqualified");
		expect(result.rows[0]?.dqReason).toBe("tos");
	});

	test("caps eligible rows without dropping disqualified audit rows", () => {
		const result = buildSnapshotRows({
			contestId: "contest-1",
			comments: [
				comment({ commentId: "eligible", channelId: "channel-1" }),
				comment({ commentId: "duplicate", channelId: "channel-1" }),
				comment({ commentId: "over-cap", channelId: "channel-2" })
			],
			snapshotAt: cutoff,
			keywords: ["alpha", "beta"],
			excluded: new Set(),
			flaggedCommentIds: new Set(),
			maxEntries: 1
		});

		expect(result.eligible).toBe(1);
		expect(result.rows.map((row) => row.youtubeCommentId)).toEqual(["eligible", "duplicate"]);
	});
});
