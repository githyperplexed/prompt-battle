import type { Phase, RenderState } from "$lib/utilities/phases";

export type ContestMeta = {
	id: string;
	title: string;
	subtitle: string;
	videoId: string;
	videoPublishedAt: string;
	snapshotAt: string;
	capturedAt: string | null;
	fingerprint: string | null;
	panel: string[];
};

export type DqEntry = { reason: string; count: number };

export type SnapshotData = {
	total: number;
	eligible: number;
	disqualified: number;
	dq: DqEntry[];
};

export type ScoringData = {
	eligible: number;
	total: number;
	done: number;
	perModel: { id: string; done: number }[];
};

export type EntryListItem = {
	id: string;
	author: string;
	channelId: string;
	submittedAt: string;
	text: string;
	// null when eligible; otherwise the disqualification reason key (mapped to a label in the UI).
	dqReason: string | null;
	// true for content-policy (tos) removals — the body is withheld from this payload entirely.
	redacted: boolean;
};

// Score-free entry list for the snapshot and scoring phases: ordered by submission, never carries
// (or even queries) scores, rank, or seed.
export type EntryListData = {
	entries: EntryListItem[];
	total: number;
	capped: boolean;
};

export type LeaderboardRow = {
	id: string;
	rank: number;
	seed: number | null;
	author: string;
	channelId: string;
	submittedAt: string;
	text: string;
	score: number;
	advancing: boolean;
};

export type LeaderboardData = {
	rows: LeaderboardRow[];
	totalEligible: number;
	cutRank: number;
	capped: boolean;
};

export type BracketEntrant = { seed: number | null; name: string } | null;

export type BracketMatchup = {
	id: string;
	round: number;
	slot: number;
	a: BracketEntrant;
	b: BracketEntrant;
	winnerSide: "a" | "b" | null;
};

export type BracketRound = { round: number; label: string; matchups: BracketMatchup[] };

export type Champion = {
	author: string;
	channelId: string;
	comment: string;
	score: number;
	seed: number | null;
} | null;

export type VerificationData = {
	panel: string[];
	scorePromptHash: string;
	comparePromptHash: string;
	keywordHash: string;
	fingerprint: string | null;
	judgeSettings: { key: string; value: string }[];
};

export type CompleteData = {
	champion: Champion;
	rounds: BracketRound[];
	details: Record<string, MatchupDetail>;
};

export type MatchupVote = {
	index: number;
	model: string;
	aFirst: string;
	bFirst: string;
	consistent: boolean;
	countsFor: string | null;
};

export type MatchupDetail = {
	roundLabel: string;
	aName: string;
	aSeed: number | null;
	aText: string;
	bName: string;
	bSeed: number | null;
	bText: string;
	votes: MatchupVote[];
	winnerName: string;
	resolution: string;
};

export type ContestPageData = {
	// The resolved content state: the viewed phase, or `locked`/`upcoming` when its data is gated.
	state: RenderState;
	// The viewed step itself (always a real phase), used to drive the stepper highlight independently
	// of whether that step's content is revealed, locked, or upcoming.
	view?: Phase;
	// The real lifecycle phase (independent of the viewed phase), so the stepper can keep completed
	// phases marked done even while a past or future phase is being viewed.
	progress?: RenderState;
	contest: ContestMeta | null;
	snapshot?: SnapshotData;
	scoring?: ScoringData;
	entries?: EntryListData;
	leaderboard?: LeaderboardData;
	complete?: CompleteData;
};
