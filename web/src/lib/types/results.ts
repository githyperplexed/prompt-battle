export type Judge = { id: string; slug: string };

export type ContestMeta = {
	videoId: string;
	videoPublishedAt: string;
	snapshotAt: string;
	capturedAt: string | null;
	resultsPublishedAt: string | null;
	panel: Judge[];
};

export type BracketResult = {
	// The last round the entry played.
	round: number;
	// "Champion", "Finalist", "Semifinal", "Quarterfinal", or "Round of N".
	label: string;
};

export type RankedEntry = {
	id: string;
	rank: number;
	seed: number | null;
	author: string;
	channelUrl: string;
	commentUrl: string;
	submittedAt: string;
	text: string;
	score: number;
	rawScore: number;
	penalty: number;
	// Per-judge totals in panel order.
	perJudge: number[];
	bracket: BracketResult | null;
};

export type Champion = RankedEntry & { wins: number };

export type DisqualifiedEntry = {
	id: string;
	author: string;
	channelUrl: string;
	commentUrl: string;
	submittedAt: string;
	text: string;
	reason: string;
	label: string;
	redacted: boolean;
};

export type Stats = {
	captured: number;
	eligible: number;
	disqualified: number;
	seeded: number;
	dq: { reason: string; label: string; count: number }[];
};

export type BracketEntrant = { id: string; seed: number; author: string };

export type BracketVote = { judge: string; pick: "a" | "b" | "split" };

export type BracketMatchup = {
	round: number;
	slot: number;
	a: BracketEntrant;
	b: BracketEntrant;
	winner: "a" | "b" | null;
	votes: BracketVote[];
};

export type BracketRound = {
	round: number;
	label: string;
	matchups: BracketMatchup[];
};

export type Verification = {
	panel: Judge[];
	scorePromptHash: string;
	comparePromptHash: string;
	judgeSettings: { key: string; value: string }[];
	keywordHash: string;
	revealedKeywords: string[] | null;
	revealedSalt: string | null;
	similarity: {
		hash: string;
		embeddingModel: string;
		embeddingDimensions: number;
		preprocessingVersion: number;
		cosineThreshold: number;
		lexicalThreshold: number;
		penalty: string;
	} | null;
	similarityFingerprint: string | null;
	bracketFingerprint: string | null;
	bundleUrl: string;
	bundleSha256: string;
	bundleBytes: number;
};

export type Results = {
	meta: ContestMeta;
	stats: Stats;
	champion: Champion | null;
	rounds: BracketRound[];
	ranked: RankedEntry[];
	disqualified: DisqualifiedEntry[];
	verification: Verification;
};
