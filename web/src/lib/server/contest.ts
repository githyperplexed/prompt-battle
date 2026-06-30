import { and, comparison, count, db, entry, eq, matchup, score } from "$lib/server/database";
import type {
	CompleteData,
	EntryListData,
	LeaderboardData,
	MatchupDetail,
	ScoringData,
	SnapshotData,
	VerificationData
} from "$lib/types/contest";
import { judgeLabel } from "$lib/utilities/judges";
import { aggregateTotals, rankByScore } from "$lib/utilities/ranking";

// Engine constants, mirrored from worker/src/constants.ts.
const BRACKET_SIZE = 64;

// Upper bound on rows returned to the client for the full entry/leaderboard lists. Beyond this the UI
// shows a "first N of M" note; the cap keeps the payload and DOM bounded.
export const ENTRY_LIST_CAP = 5000;

const ROUND_LABELS = [
	"Round of 64",
	"Round of 32",
	"Round of 16",
	"Quarterfinals",
	"Semifinals",
	"Final"
];

type ContestConfigShape = {
	panel?: { id: string }[];
	keywordHash?: string;
	prompts?: { score?: { hash?: string }; compare?: { hash?: string } };
	judge?: { requestSettings?: { maxRetries?: number; sampling?: string } };
};

const panelIdsOf = (config: unknown): string[] =>
	(config as ContestConfigShape | null)?.panel?.map((model) => model.id) ?? [];

const buildVerification = (
	config: ContestConfigShape | null,
	fingerprint: string | null
): VerificationData => {
	const settings = config?.judge?.requestSettings;

	return {
		panel: config?.panel?.map((model) => model.id) ?? [],
		scorePromptHash: config?.prompts?.score?.hash ?? "–",
		comparePromptHash: config?.prompts?.compare?.hash ?? "–",
		keywordHash: config?.keywordHash ?? "–",
		fingerprint,
		judgeSettings: [
			{ key: "max retries", value: String(settings?.maxRetries ?? "–") },
			{ key: "sampling", value: settings?.sampling ?? "–" },
			{ key: "orderings", value: "2 (A-first, B-first)" }
		]
	};
};

export const loadActiveContest = () =>
	db.query.contest.findFirst({ orderBy: (c, { desc }) => desc(c.createdAt) });

// Phase-agnostic: the committed config hashes exist from contest creation, so the /rules page can
// show them at any lifecycle stage (the fingerprint only fills in once the bracket has seeded).
export const loadActiveVerification = async (): Promise<VerificationData | null> => {
	const contest = await loadActiveContest();

	if (!contest) return null;

	return buildVerification(
		(contest.config ?? null) as ContestConfigShape | null,
		contest.bracketFingerprint
	);
};

export const loadSnapshotStats = async (contestId: string): Promise<SnapshotData> => {
	const rows = await db
		.select({ status: entry.status, dqReason: entry.dqReason, n: count() })
		.from(entry)
		.where(eq(entry.contestId, contestId))
		.groupBy(entry.status, entry.dqReason);

	let total = 0;
	let eligible = 0;
	let disqualified = 0;
	const dq: { reason: string; count: number }[] = [];

	for (const row of rows) {
		total += row.n;

		if (row.status === "eligible") {
			eligible += row.n;
		} else {
			disqualified += row.n;
			if (row.dqReason) dq.push({ reason: row.dqReason, count: row.n });
		}
	}

	dq.sort((a, b) => b.count - a.count);

	return { total, eligible, disqualified, dq };
};

export const loadScoringStats = async (
	contestId: string,
	modelIds: string[]
): Promise<ScoringData> => {
	const eligibleRows = await db
		.select({ n: count() })
		.from(entry)
		.where(and(eq(entry.contestId, contestId), eq(entry.status, "eligible")));
	const eligible = eligibleRows[0]?.n ?? 0;

	const scoreRows = await db
		.select({ modelId: score.modelId, n: count() })
		.from(score)
		.where(eq(score.contestId, contestId))
		.groupBy(score.modelId);

	const byModel = new Map(scoreRows.map((row) => [row.modelId, row.n]));
	const done = scoreRows.reduce((sum, row) => sum + row.n, 0);
	const perModel = modelIds.map((id) => ({ id, done: byModel.get(id) ?? 0 }));

	return { eligible, total: eligible * modelIds.length, done, perModel };
};

// The snapshot/scoring entry list. Deliberately selects no score/rank/seed columns and never touches
// the score table, so scores cannot leak before the reveal. Ordered by submission time. The snapshot
// view passes `includeDisqualified` to show the full field with reason badges; scoring stays
// eligible-only. Content-policy (tos) bodies are blanked here so they never reach the client.
export const loadEntryList = async (
	contestId: string,
	includeDisqualified: boolean
): Promise<EntryListData> => {
	const scope = includeDisqualified
		? eq(entry.contestId, contestId)
		: and(eq(entry.contestId, contestId), eq(entry.status, "eligible"));

	const totalRows = await db.select({ n: count() }).from(entry).where(scope);
	const total = totalRows[0]?.n ?? 0;

	const rows = await db.query.entry.findMany({
		where: (e, { and, eq }) =>
			includeDisqualified
				? eq(e.contestId, contestId)
				: and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		orderBy: (e, { asc }) => asc(e.publishedAt),
		limit: ENTRY_LIST_CAP,
		columns: {
			id: true,
			authorDisplayName: true,
			channelId: true,
			publishedAt: true,
			text: true,
			status: true,
			dqReason: true
		}
	});

	return {
		entries: rows.map((e) => {
			const disqualified = e.status === "disqualified";
			const redacted = disqualified && e.dqReason === "tos";

			return {
				id: e.id,
				author: e.authorDisplayName,
				channelId: e.channelId,
				submittedAt: e.publishedAt.toISOString(),
				text: redacted ? "" : e.text,
				dqReason: disqualified ? (e.dqReason ?? "deleted") : null,
				redacted
			};
		}),
		total,
		capped: total > ENTRY_LIST_CAP
	};
};

// Full ranked leaderboard. Only called from the page load's `scored` branch, which the embargo
// logic already gates to post-reveal (or the dev ?phase= override), so scores never load early.
export const loadLeaderboard = async (contestId: string): Promise<LeaderboardData> => {
	const entries = await db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, authorDisplayName: true, channelId: true, publishedAt: true, text: true }
	});

	const scoreRows = await db
		.select({ entryId: score.entryId, total: score.total })
		.from(score)
		.where(eq(score.contestId, contestId));

	const totalsByEntry = new Map<string, number[]>();

	for (const row of scoreRows) {
		const list = totalsByEntry.get(row.entryId) ?? [];
		list.push(row.total);
		totalsByEntry.set(row.entryId, list);
	}

	// `publishedAt` doubles as the rank tiebreaker (earlier submission wins) and the displayed time.
	const rankable = entries.flatMap((e) => {
		const totals = totalsByEntry.get(e.id);

		if (!totals || totals.length === 0) return [];

		return [
			{
				id: e.id,
				author: e.authorDisplayName,
				channelId: e.channelId,
				publishedAt: e.publishedAt,
				text: e.text,
				...aggregateTotals(totals)
			}
		];
	});

	const ranked = rankByScore(rankable).map((e, i) => ({
		id: e.id,
		author: e.author,
		channelId: e.channelId,
		submittedAt: e.publishedAt.toISOString(),
		text: e.text,
		score: e.absoluteScore,
		rank: i + 1,
		seed: i < BRACKET_SIZE ? i + 1 : null,
		advancing: i < BRACKET_SIZE
	}));

	return {
		rows: ranked.slice(0, ENTRY_LIST_CAP),
		totalEligible: ranked.length,
		cutRank: BRACKET_SIZE,
		capped: ranked.length > ENTRY_LIST_CAP
	};
};

type MatchupEntry = { seed: number | null; name: string; text: string };
type MatchupComparison = { modelId: string; orderSwapped: boolean; chosenEntryId: string };
type MatchupRow = { round: number; entryAId: string; entryBId: string; winnerId: string | null };

// Builds one matchup's detail (votes + resolution + prompt texts) from already-fetched data, so the
// whole bracket's details can be assembled in `loadComplete` without a query per matchup.
const buildMatchupDetail = (
	m: MatchupRow,
	byId: Map<string, MatchupEntry>,
	comps: MatchupComparison[],
	panel: string[]
): MatchupDetail => {
	const a = byId.get(m.entryAId) ?? { seed: null, name: "–", text: "" };
	const b = byId.get(m.entryBId) ?? { seed: null, name: "–", text: "" };
	const nameOf = (id: string) => (id === m.entryAId ? a.name : b.name);

	const votes = panel.map((modelId, i) => {
		const aFirst = comps.find((c) => c.modelId === modelId && !c.orderSwapped);
		const bFirst = comps.find((c) => c.modelId === modelId && c.orderSwapped);
		const consistent = !!aFirst && !!bFirst && aFirst.chosenEntryId === bFirst.chosenEntryId;

		return {
			index: i,
			label: judgeLabel(i),
			aFirst: aFirst ? nameOf(aFirst.chosenEntryId) : "–",
			bFirst: bFirst ? nameOf(bFirst.chosenEntryId) : "–",
			consistent,
			countsFor: consistent ? nameOf(aFirst!.chosenEntryId) : null
		};
	});

	let tallyA = 0;
	let tallyB = 0;

	for (const vote of votes) {
		if (vote.countsFor === a.name) tallyA += 1;
		else if (vote.countsFor === b.name) tallyB += 1;
	}

	const uncounted = votes.filter((vote) => !vote.consistent).length;
	const winnerName = m.winnerId === m.entryAId ? a.name : m.winnerId === m.entryBId ? b.name : "–";
	const higher = (a.seed ?? Infinity) <= (b.seed ?? Infinity) ? a : b;
	const tail = uncounted > 0 ? ` ${uncounted} vote(s) uncounted for inconsistency.` : "";

	const resolution =
		tallyA === tallyB
			? `Deadlock ${tallyA}–${tallyB}, resolved to the higher seed: #${higher.seed} ${higher.name}.${tail}`
			: `Majority ${Math.max(tallyA, tallyB)}–${Math.min(tallyA, tallyB)} for ${winnerName}.${tail}`;

	return {
		roundLabel: ROUND_LABELS[m.round - 1] ?? `Round ${m.round}`,
		aName: a.name,
		aSeed: a.seed,
		aText: a.text,
		bName: b.name,
		bSeed: b.seed,
		bText: b.text,
		votes,
		winnerName,
		resolution
	};
};

export const loadComplete = async (contestId: string): Promise<CompleteData> => {
	const contest = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { config: true, winnerEntryId: true }
	});

	const panel = panelIdsOf(contest?.config);

	let champion: CompleteData["champion"] = null;

	if (contest?.winnerEntryId) {
		const winner = await db.query.entry.findFirst({
			where: (e, { eq }) => eq(e.id, contest.winnerEntryId!),
			columns: {
				authorDisplayName: true,
				channelId: true,
				text: true,
				absoluteScore: true,
				seed: true
			}
		});

		if (winner) {
			champion = {
				author: winner.authorDisplayName,
				channelId: winner.channelId,
				comment: winner.text,
				score: winner.absoluteScore ?? 0,
				seed: winner.seed
			};
		}
	}

	const matchups = await db.query.matchup.findMany({
		where: (m, { eq }) => eq(m.contestId, contestId),
		columns: { id: true, round: true, slot: true, entryAId: true, entryBId: true, winnerId: true }
	});

	const seeded = await db.query.entry.findMany({
		where: (e, { and, eq, isNotNull }) => and(eq(e.contestId, contestId), isNotNull(e.seed)),
		columns: { id: true, seed: true, authorDisplayName: true, text: true }
	});

	const byId = new Map<string, MatchupEntry>(
		seeded.map((e) => [e.id, { seed: e.seed, name: e.authorDisplayName, text: e.text }])
	);

	// All comparisons for the bracket in one query, grouped by matchup, so every matchup's detail can
	// be built up front (preloaded with the page) rather than fetched on click.
	const matchupIds = matchups.map((m) => m.id);
	const comparisons = matchupIds.length
		? await db.query.comparison.findMany({
				where: (c, { inArray }) => inArray(c.matchupId, matchupIds),
				columns: { matchupId: true, modelId: true, orderSwapped: true, chosenEntryId: true }
			})
		: [];

	const compsByMatchup = new Map<string, MatchupComparison[]>();
	for (const c of comparisons) {
		const list = compsByMatchup.get(c.matchupId) ?? [];
		list.push(c);
		compsByMatchup.set(c.matchupId, list);
	}

	const details: Record<string, MatchupDetail> = {};
	for (const m of matchups) {
		details[m.id] = buildMatchupDetail(m, byId, compsByMatchup.get(m.id) ?? [], panel);
	}

	const nodeOf = (id: string) => {
		const e = byId.get(id);
		return e ? { seed: e.seed, name: e.name } : null;
	};

	const rounds = ROUND_LABELS.map((label, i) => ({
		round: i + 1,
		label,
		matchups: matchups
			.filter((m) => m.round === i + 1)
			.sort((a, b) => a.slot - b.slot)
			.map((m) => ({
				id: m.id,
				round: m.round,
				slot: m.slot,
				a: nodeOf(m.entryAId),
				b: nodeOf(m.entryBId),
				winnerSide:
					m.winnerId === m.entryAId
						? ("a" as const)
						: m.winnerId === m.entryBId
							? ("b" as const)
							: null
			}))
	})).filter((r) => r.matchups.length > 0);

	return { champion, rounds, details };
};

