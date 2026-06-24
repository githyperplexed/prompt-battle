import { describe, expect, test } from "bun:test";

import { classifySnapshotTiming, isSnapshotDue } from "../src/utilities/snapshot";

const cutoff = new Date("2026-06-24T12:00:00.000Z");
const before = new Date("2026-06-24T11:59:59.999Z");
const after = new Date("2026-06-24T12:00:00.001Z");

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
