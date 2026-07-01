import { describe, expect, test } from "bun:test";

import { formatStatusReport, nextStep, type StatusReport } from "../src/utilities/status";

const report: StatusReport = {
	id: "contest-1",
	videoId: "vid-1",
	status: "scoring",
	createdAt: "2026-06-25T19:41:41.000Z",
	snapshotAt: "2026-06-25T19:41:41.000Z",
	capturedAt: "2026-06-26T12:00:00.000Z",
	resultsPublishedAt: null,
	snapshotDue: null,
	panel: ["gpt-5.5", "opus-4.8", "gemini-3.1-pro"],
	scorePromptHash: "3c7941cda77642de",
	comparePromptHash: "a4abb44c0bd9c253",
	keywordHash: "92b3a4b095a228a4",
	similarityHash: "8d184f8432b8c1af",
	similarityComputedAt: null,
	similarityFingerprint: null,
	field: {
		total: 2301,
		eligible: 100,
		disqualified: 2201,
		dq: [{ reason: "too_short", count: 1800 }]
	},
	scoring: {
		done: 150,
		expected: 300,
		perModel: [
			{ id: "gpt-5.5", done: 60 },
			{ id: "opus-4.8", done: 50 },
			{ id: "gemini-3.1-pro", done: 40 }
		],
		complete: false
	},
	bracket: null
};

describe("nextStep", () => {
	test("maps each status to its next command", () => {
		expect(nextStep("snapshotted", false)).toContain("score");
		expect(nextStep("scored", false)).toContain("advance");
		expect(nextStep("complete", false)).toContain("publish");
		expect(nextStep("complete", true)).toContain("complete");
	});
});

describe("formatStatusReport", () => {
	test("renders status, field, and scoring sections with a next step", () => {
		const text = formatStatusReport(report).join("\n");

		expect(text).toContain("Contest contest-1");
		expect(text).toContain("status:");
		expect(text).toContain("Field");
		expect(text).toContain("eligible:");
		expect(text).toContain("Scoring");
		expect(text).toContain("150 / 300");
		expect(text).toContain("Next →");
	});

	test("omits sections that haven't been reached", () => {
		const text = formatStatusReport({ ...report, field: null, scoring: null }).join("\n");

		expect(text).not.toContain("Field");
		expect(text).not.toContain("Scoring");
	});
});
