import { describe, expect, test } from "bun:test";

import { aggregateTotals, rankEntries } from "../src/utilities/ranking";

const at = (iso: string) => new Date(iso);

const entry = (id: string, totals: number[], publishedAt = at("2026-06-24T10:00:00.000Z")) => ({
	id,
	publishedAt,
	...aggregateTotals(totals)
});

describe("aggregateTotals", () => {
	test("computes the mean rounded to one decimal, the min, and the variance", () => {
		const aggregate = aggregateTotals([80, 85, 91]);

		expect(aggregate.absoluteScore).toBe(85.3);
		expect(aggregate.minModel).toBe(80);
		expect(aggregate.variance).toBeCloseTo(20.222, 3);
	});
});

describe("rankEntries (§7.6)", () => {
	test("orders by absolute score descending", () => {
		const ranked = rankEntries([entry("low", [70, 70, 70]), entry("high", [90, 90, 90])]);

		expect(ranked.map((e) => e.id)).toEqual(["high", "low"]);
	});

	test("breaks score ties by higher minimum single-model score", () => {
		// Same mean (80), different mins: [70, 80, 90] vs [78, 80, 82].
		const ranked = rankEntries([entry("spread", [70, 80, 90]), entry("consensus", [78, 80, 82])]);

		expect(ranked.map((e) => e.id)).toEqual(["consensus", "spread"]);
	});

	test("breaks score and min ties by lower variance", () => {
		// Same mean (80) and min (70): variances differ.
		const ranked = rankEntries([entry("wide", [70, 70, 100]), entry("tight", [70, 85, 85])]);

		expect(ranked.map((e) => e.id)).toEqual(["tight", "wide"]);
	});

	test("breaks full scoring ties by earlier snapshot timestamp", () => {
		const ranked = rankEntries([
			entry("later", [80, 80, 80], at("2026-06-24T11:00:00.000Z")),
			entry("earlier", [80, 80, 80], at("2026-06-24T10:00:00.000Z"))
		]);

		expect(ranked.map((e) => e.id)).toEqual(["earlier", "later"]);
	});

	test("is deterministic on a complete tie regardless of input order", () => {
		const a = entry("aaa", [80, 80, 80]);
		const b = entry("bbb", [80, 80, 80]);

		expect(rankEntries([a, b]).map((e) => e.id)).toEqual(["aaa", "bbb"]);
		expect(rankEntries([b, a]).map((e) => e.id)).toEqual(["aaa", "bbb"]);
	});
});
