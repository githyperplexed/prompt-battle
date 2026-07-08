import { describe, expect, test } from "bun:test";

import { auditScoreCoverage, exceedsUnscorableGuardrail } from "../src/utilities/scoring";

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

describe("exceedsUnscorableGuardrail", () => {
	test("allows rare refusals in a small field", () => {
		expect(exceedsUnscorableGuardrail(0, 100)).toBe(false);
		expect(exceedsUnscorableGuardrail(1, 100)).toBe(false);
		expect(exceedsUnscorableGuardrail(5, 100)).toBe(false);
	});

	test("trips past the absolute floor in a small field", () => {
		expect(exceedsUnscorableGuardrail(6, 100)).toBe(true);
	});

	test("scales with the field size past the floor", () => {
		expect(exceedsUnscorableGuardrail(100, 10000)).toBe(false);
		expect(exceedsUnscorableGuardrail(101, 10000)).toBe(true);
	});

	test("uses the floor when the share of a tiny field rounds below it", () => {
		expect(exceedsUnscorableGuardrail(5, 10)).toBe(false);
		expect(exceedsUnscorableGuardrail(6, 10)).toBe(true);
	});

	test("an operator allowance replaces the computed threshold", () => {
		expect(exceedsUnscorableGuardrail(12, 100, 12)).toBe(false);
		expect(exceedsUnscorableGuardrail(13, 100, 12)).toBe(true);
	});

	test("an allowance of zero suppresses every auto-disqualification", () => {
		expect(exceedsUnscorableGuardrail(1, 100, 0)).toBe(true);
		expect(exceedsUnscorableGuardrail(0, 100, 0)).toBe(false);
	});
});
