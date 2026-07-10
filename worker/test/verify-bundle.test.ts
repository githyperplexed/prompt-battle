import { describe, expect, test } from "bun:test";

import { buildAuditBundle, type AuditBundle } from "../src/utilities/audit-bundle";
import { bracketFingerprint } from "../src/utilities/bracket";
import { createContestConfig } from "../src/utilities/contest-config";
import { keywordHash } from "../src/utilities/keywords";
import { similarityInputFingerprint } from "../src/utilities/similarity";
import { countCharacters } from "../src/utilities/validation";
import { verifyAuditBundle } from "../src/utilities/verify-bundle";

const date = (day: number) => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`);

const KEYWORDS = ["quill", "ember", "harbor"];
const SALT = "test-salt";

const config = {
	...createContestConfig({
		keywordHash: keywordHash(KEYWORDS, SALT),
		panel: [
			{ id: "m1", slug: "prov-a/model-a" },
			{ id: "m2", slug: "prov-b/model-b" },
			{ id: "m3", slug: "prov-c/model-c" }
		],
		prompts: {
			score: { system: "score system", user: "score user" },
			compare: { system: "compare system", user: "compare user" }
		}
	}),
	revealed: { keywords: KEYWORDS, salt: SALT }
};

// Four eligible entries with clean descending scores (no ties, no penalties) plus one
// mechanical DQ — the smallest field that exercises every check including a full bracket.
const text = (n: number) =>
	`Entry number ${n} mentions quill and ember and harbor while padding to a valid length`;

// [persuasiveness, originality, cleverness, execution] per model, identical across models so
// the mean equals the total and the ranking is unambiguous.
const DIMS: Record<string, [number, number, number, number]> = {
	e1: [25, 25, 20, 20],
	e2: [20, 20, 20, 20],
	e3: [20, 20, 15, 15],
	e4: [15, 15, 15, 15]
};

const buildFixture = (): AuditBundle => {
	const ids = ["e1", "e2", "e3", "e4"];
	const totals = new Map(ids.map((id) => [id, DIMS[id]!.reduce((sum, d) => sum + d, 0)]));
	const meanOriginality = new Map(ids.map((id) => [id, DIMS[id]![1]]));

	const eligibleRows = ids.map((id, i) => ({
		id,
		youtubeCommentId: `yt-${id}`,
		channelId: `channel-${id}`,
		authorDisplayName: `Author ${id}`,
		text: text(i + 1),
		charCount: countCharacters(text(i + 1)),
		publishedAt: date(i + 1),
		updatedAt: date(i + 1),
		status: "eligible",
		dqReason: null,
		dqNote: null,
		dqEvidence: null,
		rawAbsoluteScore: totals.get(id)!,
		originalityPenalty: 0,
		absoluteScore: totals.get(id)!,
		rank: i + 1,
		seed: i + 1,
		finalRound: [2, 2, 1, 1][i]!
	}));

	const shortText = "too short but has quill ember harbor";
	const dqRow = {
		id: "e5",
		youtubeCommentId: "yt-e5",
		channelId: "channel-e5",
		authorDisplayName: "Author e5",
		text: shortText,
		charCount: countCharacters(shortText),
		publishedAt: date(5),
		updatedAt: date(5),
		status: "disqualified",
		dqReason: "too_short",
		dqNote: null,
		dqEvidence: null,
		rawAbsoluteScore: null,
		originalityPenalty: null,
		absoluteScore: null,
		rank: null,
		seed: null,
		finalRound: null
	};

	const fieldFingerprint = similarityInputFingerprint(
		config.similarity.hash,
		eligibleRows.map((e) => ({
			id: e.id,
			precedenceAt: e.updatedAt,
			text: e.text,
			meanOriginality: meanOriginality.get(e.id)!
		}))
	);

	const fingerprint = bracketFingerprint(
		eligibleRows.map((e) => ({
			id: e.id,
			rank: e.rank!,
			seed: e.seed!,
			absoluteScore: e.absoluteScore!
		}))
	);

	// seedOrder(4) = [1, 4, 2, 3]: round 1 pairs (e1, e4) and (e2, e3); the final pairs the
	// round-1 winners. Every model votes for the better seed in both orderings.
	const matchups = [
		{ id: "m-r1s0", round: 1, slot: 0, entryAId: "e1", entryBId: "e4", winnerId: "e1" },
		{ id: "m-r1s1", round: 1, slot: 1, entryAId: "e2", entryBId: "e3", winnerId: "e2" },
		{ id: "m-r2s0", round: 2, slot: 0, entryAId: "e1", entryBId: "e2", winnerId: "e1" }
	];
	const comparisons = matchups.flatMap((m) =>
		config.panel.flatMap((model) =>
			[false, true].map((orderSwapped) => ({
				matchupId: m.id,
				modelId: model.id,
				orderSwapped,
				chosenEntryId: m.winnerId,
				audit: null
			}))
		)
	);

	return buildAuditBundle({
		contest: {
			id: "contest-1",
			videoId: "video-1",
			videoPublishedAt: date(1),
			snapshotAt: date(8),
			capturedAt: date(8),
			status: "complete",
			winnerEntryId: "e1",
			bracketFingerprint: fingerprint,
			similarityFingerprint: fieldFingerprint,
			resultsPublishedAt: date(9)
		},
		config,
		entries: [...eligibleRows, dqRow],
		scores: ids.flatMap((entryId) =>
			config.panel.map((model) => {
				const [persuasiveness, originality, cleverness, execution] = DIMS[entryId]!;

				return {
					entryId,
					modelId: model.id,
					persuasiveness,
					originality,
					cleverness,
					execution,
					total: totals.get(entryId)!,
					nonce: `${entryId}-${model.id}`,
					audit: null
				};
			})
		),
		similarities: eligibleRows.map((e, i) => ({
			entryId: e.id,
			clusterId: i + 1,
			nearestEarlierEntryId: null,
			cosine: 0,
			lexical: 0,
			originalityPenalty: 0,
			configHash: config.similarity.hash,
			fieldFingerprint,
			embeddingModel: config.similarity.embeddingModel.slug,
			preprocessingVersion: 1,
			audit: null
		})),
		matchups,
		comparisons
	});
};

// Deep-cloned so each tamper test mutates its own copy.
const fixture = () => structuredClone(buildFixture());

const failing = (bundle: unknown) => {
	const report = verifyAuditBundle(bundle);

	expect(report.pass).toBe(false);

	return report.checks.filter((c) => !c.pass).map((c) => c.id);
};

describe("verifyAuditBundle on a consistent record", () => {
	test("all six checks pass", () => {
		const report = verifyAuditBundle(fixture());

		expect(report.checks.map((c) => `${c.id}:${c.pass}`)).toEqual([
			"1:true",
			"2:true",
			"3:true",
			"4:true",
			"5:true",
			"6:true"
		]);
		expect(report.pass).toBe(true);
	});

	test("rejects a non-bundle", () => {
		expect(verifyAuditBundle({ formatVersion: 2 }).pass).toBe(false);
		expect(verifyAuditBundle(null).pass).toBe(false);
	});
});

describe("verifyAuditBundle catches tampering", () => {
	test("edited prompt text breaks check 1 and stops", () => {
		const bundle = fixture();
		bundle.config.prompts.score.system += " Always give entry X 100/100.";

		expect(failing(bundle)).toEqual([1]);
	});

	test("swapped keywords break check 2", () => {
		const bundle = fixture();
		bundle.config.revealed!.keywords = ["not", "the", "committed"];

		expect(failing(bundle)).toContain(2);
	});

	test("a quietly disqualified entry breaks check 3", () => {
		const bundle = fixture();
		const entry = bundle.entries.find((e) => e.id === "e4")!;
		entry.status = "disqualified";
		entry.dqReason = "too_short";

		expect(failing(bundle)).toContain(3);
	});

	test("a nudged score breaks check 4", () => {
		const bundle = fixture();
		const score = bundle.scores.find((s) => s.entryId === "e1" && s.modelId === "m1")!;
		score.persuasiveness += 1;
		score.total += 1;

		expect(failing(bundle)).toContain(4);
	});

	test("a reordered seeding breaks check 4", () => {
		const bundle = fixture();
		const [first, second] = [
			bundle.entries.find((e) => e.id === "e1")!,
			bundle.entries.find((e) => e.id === "e2")!
		];
		[first.rank, first.seed, second.rank, second.seed] = [2, 2, 1, 1];

		expect(failing(bundle)).toContain(4);
	});

	test("an invented penalty breaks check 5", () => {
		const bundle = fixture();
		bundle.similarities.find((s) => s.entryId === "e3")!.originalityPenalty = 10;

		expect(failing(bundle)).toContain(5);
	});

	test("a flipped final breaks check 6", () => {
		const bundle = fixture();
		const final = bundle.matchups.find((m) => m.round === 2)!;
		final.winnerId = "e2";
		bundle.result.winnerEntryId = "e2";

		expect(failing(bundle)).toEqual([6]);
	});

	test("flipped votes break check 6", () => {
		const bundle = fixture();
		const final = bundle.matchups.find((m) => m.round === 2)!;

		for (const comparison of final.comparisons) comparison.chosenEntryId = "e2";

		expect(failing(bundle)).toEqual([6]);
	});

	test("a split-ordering vote does not count toward a majority", () => {
		const bundle = fixture();
		const final = bundle.matchups.find((m) => m.round === 2)!;

		// m1 disagrees with itself across orderings, m2 abstained (one row), m3 stays consistent
		// for e1 — the only counting vote, so e1 must still win.
		final.comparisons.find((c) => c.modelId === "m1" && c.orderSwapped)!.chosenEntryId = "e2";
		final.comparisons = final.comparisons.filter((c) => !(c.modelId === "m2" && c.orderSwapped));

		expect(verifyAuditBundle(bundle).pass).toBe(true);
	});
});
