import { describe, expect, test } from "bun:test";

import { auditScoreCoverage } from "../src/utilities/scoring";

const entries = [{ id: "entry-a" }, { id: "entry-b" }];
const models = [{ id: "model-1" }, { id: "model-2" }, { id: "model-3" }];

describe("auditScoreCoverage", () => {
	test("accepts exactly one score from every panel model for every entry", () => {
		const scores = entries.flatMap((entry) =>
			models.map((model) => ({ entryId: entry.id, modelId: model.id }))
		);

		expect(auditScoreCoverage(entries, models, scores)).toEqual({
			complete: true,
			missing: [],
			unexpected: []
		});
	});

	test("reports a missing entry and model pair", () => {
		const scores = [{ entryId: "entry-a", modelId: "model-1" }];
		const result = auditScoreCoverage(entries, models, scores);

		expect(result.complete).toBe(false);
		expect(result.missing).toContainEqual({ entryId: "entry-b", modelId: "model-3" });
	});

	test("rejects scores from models outside the panel", () => {
		const scores = entries.flatMap((entry) =>
			models.map((model) => ({ entryId: entry.id, modelId: model.id }))
		);
		scores.push({ entryId: "entry-a", modelId: "old-model" });
		const result = auditScoreCoverage(entries, models, scores);

		expect(result.complete).toBe(false);
		expect(result.unexpected).toEqual([{ entryId: "entry-a", modelId: "old-model" }]);
	});

	test("treats a contest with no eligible entries as fully scored", () => {
		expect(auditScoreCoverage([], models, [])).toEqual({
			complete: true,
			missing: [],
			unexpected: []
		});
	});
});
