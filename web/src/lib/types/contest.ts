import type { RenderState } from "$lib/utilities/phases";

export type ContestMeta = {
	id: string;
	title: string;
	subtitle: string;
	videoId: string;
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

export type SearchOutcome =
	| {
			kind: "eligible";
			author: string;
			channelId: string;
			comment: string;
			rank: number | null;
			seed: number | null;
	  }
	| {
			kind: "disqualified";
			author: string;
			channelId: string;
			reason: string;
			reasonLabel: string;
			redacted: boolean;
			comment: string | null;
	  }
	| { kind: "none"; query: string };

export type LeaderboardRow = {
	id: string;
	rank: number;
	seed: number | null;
	author: string;
	channelId: string;
	score: number;
	advancing: boolean;
};

export type LeaderboardData = {
	rows: LeaderboardRow[];
	mode: "top" | "cut";
	page: number;
	pageSize: number;
	totalEligible: number;
	cutRank: number;
};

export type MatrixRow = {
	index: number;
	label: string;
	persuasiveness: number;
	originality: number;
	cleverness: number;
	execution: number;
	total: number;
};

export type EntryDetail = {
	comment: string;
	matrix: MatrixRow[];
	score: number;
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
	verification: VerificationData;
};

export type MatchupVote = {
	index: number;
	label: string;
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
	state: RenderState;
	contest: ContestMeta | null;
	snapshot?: SnapshotData;
	scoring?: ScoringData;
	leaderboard?: LeaderboardData;
	complete?: CompleteData;
};
