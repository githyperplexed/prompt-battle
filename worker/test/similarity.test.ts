import { describe, expect, test } from "bun:test";

import {
	clusterField,
	cosine,
	jaccard,
	normalizeForSimilarity,
	shingles,
	similarityInputFingerprint
} from "../src/utilities/similarity";

const date = (day: number) => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`);
const vector = (...values: number[]) => new Float32Array(values);
const entry = (id: string, publishedAt: Date, text: string, values: number[]) => ({
	id,
	publishedAt,
	vector: vector(...values),
	shingleSet: shingles(text)
});

describe("similarity text normalization", () => {
	test("removes mandatory keywords as whole tokens and normalizes text", () => {
		expect(
			normalizeForSimilarity("Alpha EXAMPLE-ONE beta example-twoish EXAMPLE-TWO", [
				"example-one",
				"example-two",
				"missing"
			])
		).toBe("alpha beta example-twoish");
	});

	test("keeps empty texts comparable after keyword stripping", () => {
		expect(jaccard(shingles(""), shingles(""))).toBe(1);
	});
});

describe("similarity math", () => {
	test("computes cosine similarity", () => {
		expect(cosine(vector(1, 0), vector(1, 0))).toBe(1);
		expect(cosine(vector(1, 0), vector(0, 1))).toBe(0);
	});

	test("requires matching vector dimensions", () => {
		expect(() => cosine(vector(1), vector(1, 2))).toThrow("matching dimensions");
	});
});

describe("clusterField", () => {
	test("penalizes later near-duplicates and exempts the earliest originator", () => {
		const entries = [
			entry("a", date(1), "a clever exact-ish sentence", [1, 0]),
			entry("b", date(2), "a clever exact-ish sentence", [1, 0])
		];
		const results = clusterField({
			entries,
			meanOriginality: new Map([
				["a", 22],
				["b", 12]
			]),
			cosineThreshold: 0.9,
			lexicalThreshold: 0.8,
			penalty: { mode: "hard_only", hardPoints: 25, softCoefficient: 0 }
		});

		expect(results.find((r) => r.entryId === "a")?.originalityPenalty).toBe(0);
		expect(results.find((r) => r.entryId === "b")).toMatchObject({
			nearestEarlierEntryId: "a",
			originalityPenalty: 12
		});
	});

	test("does not hard-penalize semantic matches without lexical overlap", () => {
		const results = clusterField({
			entries: [
				entry("a", date(1), "totally different words here", [1, 0]),
				entry("b", date(2), "nothing alike in letters", [1, 0])
			],
			meanOriginality: new Map([["b", 20]]),
			cosineThreshold: 0.9,
			lexicalThreshold: 0.8,
			penalty: { mode: "hard_only", hardPoints: 25, softCoefficient: 0 }
		});

		expect(results.find((r) => r.entryId === "b")?.nearestEarlierEntryId).toBeNull();
		expect(results.find((r) => r.entryId === "b")?.originalityPenalty).toBe(0);
	});

	test("soft tier penalizes semantic convergence without lexical overlap when enabled", () => {
		const results = clusterField({
			entries: [
				entry("a", date(1), "totally different words here", [1, 0]),
				entry("b", date(2), "nothing alike in letters", [1, 0])
			],
			meanOriginality: new Map([["b", 20]]),
			cosineThreshold: 0.9,
			lexicalThreshold: 0.8,
			penalty: { mode: "hard_and_soft", hardPoints: 25, softCoefficient: 5 }
		});
		const later = results.find((r) => r.entryId === "b");

		expect(later?.nearestEarlierEntryId).toBe("a");
		expect(later?.originalityPenalty).toBeCloseTo(5 * Math.log(2));
	});

	test("uses nearest earlier matches for transitive chains", () => {
		const results = clusterField({
			entries: [
				entry("a", date(1), "alpha alpha alpha alpha", [1, 0]),
				entry("b", date(2), "alpha alpha alpha beta", [0.98, 0.02]),
				entry("c", date(3), "alpha alpha beta beta", [0.9, 0.1])
			],
			meanOriginality: new Map([
				["b", 20],
				["c", 20]
			]),
			cosineThreshold: 0.9,
			lexicalThreshold: 0.45,
			penalty: { mode: "hard_only", hardPoints: 10, softCoefficient: 0 }
		});

		expect(results.find((r) => r.entryId === "b")?.nearestEarlierEntryId).toBe("a");
		expect(results.find((r) => r.entryId === "c")?.nearestEarlierEntryId).toBe("b");
		expect(new Set(results.map((r) => r.clusterId)).size).toBe(1);
	});

	test("is deterministic for fixed input", () => {
		const entries = [
			entry("b", date(1), "same same same", [1, 0]),
			entry("a", date(1), "same same same", [1, 0])
		];
		const input = {
			entries,
			meanOriginality: new Map([
				["a", 20],
				["b", 20]
			]),
			cosineThreshold: 0.9,
			lexicalThreshold: 0.9,
			penalty: { mode: "hard_only" as const, hardPoints: 10, softCoefficient: 0 }
		};

		expect(clusterField(input)).toEqual(
			clusterField({ ...input, entries: [...entries].reverse() })
		);
	});

	test("fingerprint changes with score-affecting inputs", () => {
		const base = [{ id: "a", publishedAt: date(1), text: "same", meanOriginality: 10 }];
		const changed = [{ id: "a", publishedAt: date(1), text: "same", meanOriginality: 11 }];

		expect(similarityInputFingerprint("h", base)).not.toBe(
			similarityInputFingerprint("h", changed)
		);
	});
});
