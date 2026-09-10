// Shape of the audit bundle written by `worker export` (web/static/audit/<videoId>.json).
// Only the fields the site reads are typed; audit blobs stay opaque.

export type BundleEntry = {
	id: string;
	youtubeCommentId: string;
	authorDisplayName: string;
	channelId: string;
	text: string;
	charCount: number;
	publishedAt: string;
	updatedAt: string;
	status: "eligible" | "disqualified";
	dqReason: string | null;
	dqNote: string | null;
	dqEvidence: unknown;
	redacted: boolean;
	rawAbsoluteScore: number | null;
	absoluteScore: number | null;
	originalityPenalty: number | null;
	rank: number | null;
	seed: number | null;
	finalRound: number | null;
};

export type BundleScore = {
	entryId: string;
	modelId: string;
	cleverness: number;
	execution: number;
	originality: number;
	persuasiveness: number;
	total: number;
	nonce: string;
	audit: unknown;
};

export type BundleComparison = {
	modelId: string;
	orderSwapped: boolean;
	chosenEntryId: string;
	audit?: unknown;
};

export type BundleMatchup = {
	round: number;
	slot: number;
	entryAId: string;
	entryBId: string;
	winnerId: string | null;
	comparisons: BundleComparison[];
};

export type BundleSimilarity = {
	entryId: string;
	clusterId: number | null;
	nearestEarlierEntryId: string | null;
	originalityPenalty: number;
	cosine: number | null;
	lexical: number | null;
};

export type BundleConfig = {
	version: number;
	keywordHash: string;
	panel: { id: string; slug: string }[];
	prompts: { score: { hash: string }; compare: { hash: string } };
	judge: { requestSettings: Record<string, unknown> };
	similarity: {
		enabled: boolean;
		hash: string;
		embeddingModel: { slug: string };
		embeddingDimensions: number;
		cosineThreshold: number;
		lexicalThreshold: number;
		penalty: { mode: string; hardPoints: number; softCoefficient: number };
		preprocessingVersion: number;
	} | null;
	revealed: { keywords: string[]; salt: string } | null;
};

export type AuditBundle = {
	formatVersion: number;
	contest: {
		id: string;
		videoId: string;
		status: string;
		videoPublishedAt: string;
		snapshotAt: string;
		capturedAt: string | null;
		resultsPublishedAt: string | null;
	};
	config: BundleConfig;
	entries: BundleEntry[];
	scores: BundleScore[];
	matchups: BundleMatchup[];
	similarities: BundleSimilarity[];
	result: {
		winnerEntryId: string | null;
		bracketFingerprint: string | null;
		similarityFingerprint: string | null;
	};
};
