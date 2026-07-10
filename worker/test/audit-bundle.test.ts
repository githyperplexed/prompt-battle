import { describe, expect, test } from "bun:test";

import {
	auditBundleHash,
	buildAuditBundle,
	serializeAuditBundle,
	type AuditBundleInput,
	type AuditComparisonRow,
	type AuditEntryRow,
	type AuditMatchupRow,
	type AuditScoreRow,
	type AuditSimilarityRow
} from "../src/utilities/audit-bundle";
import { createContestConfig } from "../src/utilities/contest-config";

const date = (day: number) => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`);

const config = {
	...createContestConfig({
		keywordHash: "a".repeat(64),
		panel: [
			{ id: "alpha", slug: "prov-a/model-a" },
			{ id: "beta", slug: "prov-b/model-b" },
			{ id: "gamma", slug: "prov-c/model-c" }
		],
		prompts: {
			score: { system: "score system", user: "score user" },
			compare: { system: "compare system", user: "compare user" }
		}
	}),
	revealed: { keywords: ["one", "two", "three"], salt: "salt" }
};

const contest = {
	id: "contest-1",
	videoId: "video-1",
	videoPublishedAt: date(1),
	snapshotAt: date(8),
	capturedAt: date(8),
	status: "complete",
	winnerEntryId: "entry-a",
	bracketFingerprint: "f".repeat(64),
	similarityFingerprint: "e".repeat(64),
	resultsPublishedAt: date(9)
};

const entryRow = (id: string, overrides: Partial<AuditEntryRow> = {}): AuditEntryRow => ({
	id,
	youtubeCommentId: `yt-${id}`,
	channelId: `channel-${id}`,
	authorDisplayName: `Author ${id}`,
	text: `text of ${id}`,
	charCount: 60,
	publishedAt: date(2),
	updatedAt: date(2),
	status: "eligible",
	dqReason: null,
	dqNote: null,
	dqEvidence: null,
	absoluteScore: 80,
	rawAbsoluteScore: 80,
	originalityPenalty: 0,
	rank: 1,
	seed: 1,
	finalRound: null,
	...overrides
});

const scoreRow = (entryId: string, modelId: string, audit: unknown = null): AuditScoreRow => ({
	entryId,
	modelId,
	persuasiveness: 20,
	originality: 20,
	cleverness: 20,
	execution: 20,
	total: 80,
	nonce: `${entryId}-${modelId}`,
	audit
});

const similarityRow = (entryId: string): AuditSimilarityRow => ({
	entryId,
	clusterId: 1,
	nearestEarlierEntryId: null,
	cosine: 0,
	lexical: 0,
	originalityPenalty: 0,
	configHash: config.similarity.hash,
	fieldFingerprint: "e".repeat(64),
	embeddingModel: "openai/text-embedding-3-small",
	preprocessingVersion: 1,
	audit: null
});

const matchupRow = (id: string, round: number, slot: number): AuditMatchupRow => ({
	id,
	round,
	slot,
	entryAId: "entry-a",
	entryBId: "entry-b",
	winnerId: "entry-a"
});

const comparisonRow = (
	matchupId: string,
	modelId: string,
	orderSwapped: boolean
): AuditComparisonRow => ({
	matchupId,
	modelId,
	orderSwapped,
	chosenEntryId: "entry-a",
	audit: null
});

const input = (): AuditBundleInput => ({
	contest,
	config,
	entries: [entryRow("entry-b"), entryRow("entry-a")],
	scores: [scoreRow("entry-b", "alpha"), scoreRow("entry-a", "beta"), scoreRow("entry-a", "alpha")],
	similarities: [similarityRow("entry-b"), similarityRow("entry-a")],
	matchups: [matchupRow("m2", 2, 0), matchupRow("m1", 1, 0)],
	comparisons: [
		comparisonRow("m1", "beta", false),
		comparisonRow("m1", "alpha", true),
		comparisonRow("m1", "alpha", false)
	]
});

describe("buildAuditBundle", () => {
	test("sorts every collection deterministically regardless of input order", () => {
		const bundle = buildAuditBundle(input());

		expect(bundle.entries.map((e) => e.id)).toEqual(["entry-a", "entry-b"]);
		expect(bundle.scores.map((s) => `${s.entryId}/${s.modelId}`)).toEqual([
			"entry-a/alpha",
			"entry-a/beta",
			"entry-b/alpha"
		]);
		expect(bundle.matchups.map((m) => m.round)).toEqual([1, 2]);
		expect(bundle.matchups[0]?.comparisons.map((c) => `${c.modelId}/${c.orderSwapped}`)).toEqual([
			"alpha/false",
			"alpha/true",
			"beta/false"
		]);
	});

	test("blanks the text of content-policy removals and only those", () => {
		const bundle = buildAuditBundle({
			...input(),
			entries: [
				entryRow("entry-a", { status: "disqualified", dqReason: "tos", dqNote: "operator note" }),
				entryRow("entry-b", { status: "disqualified", dqReason: "deleted" })
			]
		});

		const [a, b] = bundle.entries;

		expect(a?.text).toBe("");
		expect(a?.redacted).toBe(true);
		expect(a?.dqNote).toBe("operator note");
		expect(b?.text).toBe("text of entry-b");
		expect(b?.redacted).toBe(false);
	});

	test("refuses comparisons that reference a matchup outside the contest", () => {
		expect(() =>
			buildAuditBundle({ ...input(), comparisons: [comparisonRow("elsewhere", "alpha", false)] })
		).toThrow("reference a matchup");
	});
});

describe("serializeAuditBundle", () => {
	test("same rows produce byte-identical output and the same hash", () => {
		const first = serializeAuditBundle(buildAuditBundle(input()));
		const second = serializeAuditBundle(buildAuditBundle(input()));

		expect(first).toBe(second);
		expect(auditBundleHash(first)).toBe(auditBundleHash(second));
	});

	test("audit blobs serialize independently of key insertion order", () => {
		const withAudit = (audit: unknown) => ({
			...input(),
			scores: [scoreRow("entry-a", "alpha", audit)]
		});

		expect(serializeAuditBundle(buildAuditBundle(withAudit({ b: 1, a: 2 })))).toBe(
			serializeAuditBundle(buildAuditBundle(withAudit({ a: 2, b: 1 })))
		);
	});

	test("any changed row changes the hash", () => {
		const base = auditBundleHash(serializeAuditBundle(buildAuditBundle(input())));
		const changed = input();
		changed.scores[0] = { ...changed.scores[0]!, total: 81 };

		expect(auditBundleHash(serializeAuditBundle(buildAuditBundle(changed)))).not.toBe(base);
	});
});
