import { createHash } from "node:crypto";

import type { ContestConfig } from "$src/utilities/contest-config";

export type AuditContestRow = {
	id: string;
	videoId: string;
	videoPublishedAt: Date;
	snapshotAt: Date;
	capturedAt: Date | null;
	status: string;
	winnerEntryId: string | null;
	bracketFingerprint: string | null;
	similarityFingerprint: string | null;
	resultsPublishedAt: Date | null;
};

export type AuditEntryRow = {
	id: string;
	youtubeCommentId: string;
	channelId: string;
	authorDisplayName: string;
	text: string;
	charCount: number;
	publishedAt: Date;
	updatedAt: Date;
	status: string;
	dqReason: string | null;
	dqNote: string | null;
	dqEvidence: string | null;
	absoluteScore: number | null;
	rawAbsoluteScore: number | null;
	originalityPenalty: number | null;
	rank: number | null;
	seed: number | null;
	finalRound: number | null;
};

export type AuditScoreRow = {
	entryId: string;
	modelId: string;
	persuasiveness: number;
	originality: number;
	cleverness: number;
	execution: number;
	total: number;
	nonce: string;
	audit: unknown;
};

export type AuditSimilarityRow = {
	entryId: string;
	clusterId: number;
	nearestEarlierEntryId: string | null;
	cosine: number;
	lexical: number;
	originalityPenalty: number;
	configHash: string;
	fieldFingerprint: string;
	embeddingModel: string;
	preprocessingVersion: number;
	audit: unknown;
};

export type AuditMatchupRow = {
	id: string;
	round: number;
	slot: number;
	entryAId: string;
	entryBId: string;
	winnerId: string | null;
};

export type AuditComparisonRow = {
	matchupId: string;
	modelId: string;
	orderSwapped: boolean;
	chosenEntryId: string;
	audit: unknown;
};

export type AuditBundleInput = {
	contest: AuditContestRow;
	config: ContestConfig;
	entries: AuditEntryRow[];
	scores: AuditScoreRow[];
	similarities: AuditSimilarityRow[];
	matchups: AuditMatchupRow[];
	comparisons: AuditComparisonRow[];
};

export type AuditBundle = ReturnType<typeof buildAuditBundle>;

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export const buildAuditBundle = (input: AuditBundleInput) => {
	const comparisonsByMatchup = new Map<string, AuditComparisonRow[]>();

	for (const comparison of input.comparisons) {
		const list = comparisonsByMatchup.get(comparison.matchupId) ?? [];
		list.push(comparison);
		comparisonsByMatchup.set(comparison.matchupId, list);
	}

	const matchupIds = new Set(input.matchups.map((matchup) => matchup.id));
	const orphaned = input.comparisons.filter((c) => !matchupIds.has(c.matchupId));

	if (orphaned.length > 0) {
		throw new Error(`${orphaned.length} comparison(s) reference a matchup outside the contest`);
	}

	return {
		formatVersion: 1 as const,
		contest: {
			id: input.contest.id,
			videoId: input.contest.videoId,
			videoPublishedAt: input.contest.videoPublishedAt.toISOString(),
			snapshotAt: input.contest.snapshotAt.toISOString(),
			capturedAt: iso(input.contest.capturedAt),
			status: input.contest.status,
			resultsPublishedAt: iso(input.contest.resultsPublishedAt)
		},
		// The frozen contest config verbatim, including the post-publish `revealed` keywords + salt.
		// Its hashes self-validated at parse, so the bundle can only ever carry a consistent config.
		config: input.config,
		result: {
			winnerEntryId: input.contest.winnerEntryId,
			bracketFingerprint: input.contest.bracketFingerprint,
			similarityFingerprint: input.contest.similarityFingerprint
		},
		entries: [...input.entries]
			.sort((a, b) => a.id.localeCompare(b.id))
			.map((entry) => {
				// Redaction parity with the public site (web loadEntryList): content-policy removals
				// keep their row but never their text — the bundle must not become a side channel.
				const redacted = entry.status === "disqualified" && entry.dqReason === "tos";

				return {
					id: entry.id,
					youtubeCommentId: entry.youtubeCommentId,
					channelId: entry.channelId,
					authorDisplayName: entry.authorDisplayName,
					text: redacted ? "" : entry.text,
					redacted,
					charCount: entry.charCount,
					publishedAt: entry.publishedAt.toISOString(),
					updatedAt: entry.updatedAt.toISOString(),
					status: entry.status,
					dqReason: entry.dqReason,
					dqNote: entry.dqNote,
					dqEvidence: entry.dqEvidence,
					absoluteScore: entry.absoluteScore,
					rawAbsoluteScore: entry.rawAbsoluteScore,
					originalityPenalty: entry.originalityPenalty,
					rank: entry.rank,
					seed: entry.seed,
					finalRound: entry.finalRound
				};
			}),
		scores: [...input.scores]
			.sort((a, b) => a.entryId.localeCompare(b.entryId) || a.modelId.localeCompare(b.modelId))
			.map((score) => ({
				entryId: score.entryId,
				modelId: score.modelId,
				persuasiveness: score.persuasiveness,
				originality: score.originality,
				cleverness: score.cleverness,
				execution: score.execution,
				total: score.total,
				nonce: score.nonce,
				audit: score.audit ?? null
			})),
		// Embedding vectors are deliberately excluded: they exist only for --store-vectors runs and
		// would dominate the bundle's size. The recorded similarities + committed config are what
		// Check 5 verifies against.
		similarities: [...input.similarities]
			.sort((a, b) => a.entryId.localeCompare(b.entryId))
			.map((row) => ({
				entryId: row.entryId,
				clusterId: row.clusterId,
				nearestEarlierEntryId: row.nearestEarlierEntryId,
				cosine: row.cosine,
				lexical: row.lexical,
				originalityPenalty: row.originalityPenalty,
				configHash: row.configHash,
				fieldFingerprint: row.fieldFingerprint,
				embeddingModel: row.embeddingModel,
				preprocessingVersion: row.preprocessingVersion,
				audit: row.audit ?? null
			})),
		matchups: [...input.matchups]
			.sort((a, b) => a.round - b.round || a.slot - b.slot)
			.map((matchup) => ({
				round: matchup.round,
				slot: matchup.slot,
				entryAId: matchup.entryAId,
				entryBId: matchup.entryBId,
				winnerId: matchup.winnerId,
				comparisons: (comparisonsByMatchup.get(matchup.id) ?? [])
					.sort(
						(a, b) =>
							a.modelId.localeCompare(b.modelId) || Number(a.orderSwapped) - Number(b.orderSwapped)
					)
					.map((comparison) => ({
						modelId: comparison.modelId,
						orderSwapped: comparison.orderSwapped,
						chosenEntryId: comparison.chosenEntryId,
						audit: comparison.audit ?? null
					}))
			}))
	};
};

// Deep-sorted keys make the serialization independent of construction and driver key order, so
// the same rows always produce byte-identical output — the property that makes the file hashable
// as a whole.
const sortKeys = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(sortKeys);

	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.sort()
				.map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
		);
	}

	return value;
};

export const serializeAuditBundle = (bundle: AuditBundle): string =>
	JSON.stringify(sortKeys(bundle), null, "\t") + "\n";

export const auditBundleHash = (serialized: string): string =>
	createHash("sha256").update(serialized).digest("hex");
