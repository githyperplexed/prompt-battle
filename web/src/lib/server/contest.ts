import {
	and,
	comparison,
	count,
	db,
	entry,
	eq,
	matchup,
	score,
	similarity
} from "$lib/server/database";
import type {
	BracketEntrant,
	BracketMatchup,
	BracketRound,
	CompleteData,
	EntryListData,
	LeaderboardData,
	MatchupDetail,
	ScoringData,
	SnapshotData,
	VerificationData
} from "$lib/types/contest";
import { nextPowerOfTwo, seedOrder } from "$lib/utilities/bracket";
import { aggregateTotals, rankByScore } from "$lib/utilities/ranking";

// Engine constants, mirrored from worker/src/constants.ts.
const BRACKET_SIZE = 64;

// Upper bound on rows returned to the client for the full entry/leaderboard lists. Beyond this the UI
// shows a "first N of M" note; the cap keeps the payload and DOM bounded.
export const ENTRY_LIST_CAP = 5000;

// Rounds are labeled by distance from the final, not by absolute number, so a field smaller than
// BRACKET_SIZE starts at the right round. A 12-entrant field runs a 16-slot bracket with byes:
// `totalRounds` is 4, so round 1 is the "Round of 16" (not "Round of 64"). `size` is the number of
// slots contested entering `round` (2 at the final).
const roundLabel = (round: number, totalRounds: number): { label: string; short: string } => {
	const size = 2 ** (totalRounds - round + 1);

	if (size <= 2) return { label: "Final", short: "F" };
	if (size === 4) return { label: "Semifinals", short: "SF" };
	if (size === 8) return { label: "Quarterfinals", short: "QF" };

	return { label: `Round of ${size}`, short: `R${size}` };
};

type ContestConfigShape = {
	panel?: { id: string }[];
	keywordHash?: string;
	revealed?: { keywords: string[]; salt: string };
	prompts?: { score?: { hash?: string }; compare?: { hash?: string } };
	judge?: { requestSettings?: { maxRetries?: number; sampling?: string } };
	similarity?: {
		enabled?: boolean;
		hash?: string;
		embeddingModel?: { slug?: string };
		preprocessingVersion?: number;
		cosineThreshold?: number;
		lexicalThreshold?: number;
		penalty?: { mode?: string; hardPoints?: number; softCoefficient?: number };
	};
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
		revealedKeywords: config?.revealed?.keywords ?? null,
		revealedSalt: config?.revealed?.salt ?? null,
		fingerprint,
		judgeSettings: [
			{ key: "max retries", value: String(settings?.maxRetries ?? "–") },
			{ key: "sampling", value: settings?.sampling ?? "–" },
			{ key: "orderings", value: "2 (A-first, B-first)" }
		],
		similarity: config?.similarity
			? {
					enabled: !!config.similarity.enabled,
					hash: config.similarity.hash ?? "–",
					embeddingModel: config.similarity.embeddingModel?.slug ?? "–",
					preprocessingVersion: config.similarity.preprocessingVersion ?? 0,
					cosineThreshold: config.similarity.cosineThreshold ?? 0,
					lexicalThreshold: config.similarity.lexicalThreshold ?? 0,
					penalty: `${config.similarity.penalty?.mode ?? "–"}; hard ${config.similarity.penalty?.hardPoints ?? "–"}; soft ${config.similarity.penalty?.softCoefficient ?? "–"}`
				}
			: null
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
export const loadLeaderboard = async (
	contestId: string,
	panel: string[]
): Promise<LeaderboardData> => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { similarityFingerprint: true }
	});
	const entries = await db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, authorDisplayName: true, channelId: true, publishedAt: true, text: true }
	});

	const scoreRows = await db
		.select({ entryId: score.entryId, modelId: score.modelId, total: score.total })
		.from(score)
		.where(eq(score.contestId, contestId));
	const currentSimilarityRows = target?.similarityFingerprint
		? await db.query.similarity.findMany({
				where: (s, { and, eq }) =>
					and(eq(s.contestId, contestId), eq(s.fieldFingerprint, target.similarityFingerprint!)),
				columns: {
					entryId: true,
					clusterId: true,
					nearestEarlierEntryId: true,
					originalityPenalty: true
				}
			})
		: [];
	const similarityRows =
		currentSimilarityRows.length === entries.length ? currentSimilarityRows : [];

	const totalsByEntry = new Map<string, number[]>();
	const perModelByEntry = new Map<string, Map<string, number>>();
	const similarityByEntry = new Map(similarityRows.map((row) => [row.entryId, row]));

	for (const row of scoreRows) {
		const list = totalsByEntry.get(row.entryId) ?? [];
		list.push(row.total);
		totalsByEntry.set(row.entryId, list);

		const byModel = perModelByEntry.get(row.entryId) ?? new Map<string, number>();
		byModel.set(row.modelId, row.total);
		perModelByEntry.set(row.entryId, byModel);
	}

	const rankable = entries.flatMap((e) => {
		const totals = totalsByEntry.get(e.id);

		if (!totals || totals.length === 0) return [];

		const aggregate = aggregateTotals(totals);
		const similarity = similarityByEntry.get(e.id);
		const originalityPenalty = similarity?.originalityPenalty ?? 0;

		return [
			{
				id: e.id,
				author: e.authorDisplayName,
				channelId: e.channelId,
				publishedAt: e.publishedAt,
				text: e.text,
				byModel: perModelByEntry.get(e.id) ?? new Map<string, number>(),
				...aggregate,
				rawScore: aggregate.absoluteScore,
				originalityPenalty,
				clusterId: similarity?.clusterId ?? null,
				nearestEarlierEntryId: similarity?.nearestEarlierEntryId ?? null,
				absoluteScore: Math.round((aggregate.absoluteScore - originalityPenalty) * 10) / 10
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
		rawScore: e.rawScore,
		originalityPenalty: e.originalityPenalty,
		clusterId: e.clusterId,
		nearestEarlierEntryId: e.nearestEarlierEntryId,
		perModel: panel.flatMap((model) => {
			const total = e.byModel.get(model);

			return total === undefined ? [] : [{ model, total }];
		}),
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
	panel: string[],
	totalRounds: number
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
			model: modelId,
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
		roundLabel: roundLabel(m.round, totalRounds).label,
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

	// The seeded field runs a nextPowerOfTwo(field)-slot bracket, so its depth (and every round's
	// label) is fixed by the field size, independent of how many byes trimmed the first round.
	const bracketSize = nextPowerOfTwo(seeded.length);
	const totalRounds = bracketSize > 1 ? Math.log2(bracketSize) : 0;

	const details: Record<string, MatchupDetail> = {};
	for (const m of matchups) {
		details[m.id] = buildMatchupDetail(m, byId, compsByMatchup.get(m.id) ?? [], panel, totalRounds);
	}

	const nodeOf = (id: string | null): BracketEntrant => {
		if (!id) return null;

		const e = byId.get(id);
		return e ? { seed: e.seed, name: e.name } : null;
	};

	const idBySeed = new Map<number, string>();
	for (const e of seeded) if (e.seed != null) idBySeed.set(e.seed, e.id);

	const matchupByRoundSlot = new Map<string, (typeof matchups)[number]>();
	for (const m of matchups) matchupByRoundSlot.set(`${m.round}:${m.slot}`, m);

	// Reconstruct the whole seeded bracket — including the bye slots the worker never persisted as
	// matchup rows — so the client always receives a complete binary tree (each round exactly half
	// the previous). This keeps the renderer's parent→child (2k / 2k+1) connector math valid; a
	// smaller-than-64 field just shows byes (a lone seed advancing) in the first round. Mirrors the
	// worker's seedOrder/byes in worker/src/services/bracket.ts.
	let slots: (string | null)[] =
		bracketSize > 1 ? seedOrder(bracketSize).map((seed) => idBySeed.get(seed) ?? null) : [];

	const rounds: BracketRound[] = [];
	let round = 1;

	while (slots.length > 1) {
		const { label, short } = roundLabel(round, totalRounds);
		const matchupNodes: BracketMatchup[] = [];
		const winners: (string | null)[] = [];

		for (let slot = 0; slot * 2 < slots.length; slot += 1) {
			const aId = slots[slot * 2] ?? null;
			const bId = slots[slot * 2 + 1] ?? null;

			if (aId && bId) {
				// A contested matchup: use the stored row (entryA is the higher seed by worker
				// convention). If the row is somehow missing (partial bracket), fall back to seed order.
				const m = matchupByRoundSlot.get(`${round}:${slot}`);
				const a = m?.entryAId ?? aId;
				const b = m?.entryBId ?? bId;
				const winnerId = m?.winnerId ?? null;

				matchupNodes.push({
					id: m?.id ?? `r${round}-s${slot}`,
					round,
					slot,
					a: nodeOf(a),
					b: nodeOf(b),
					winnerSide: winnerId === a ? "a" : winnerId === b ? "b" : null
				});
				winners.push(winnerId);
			} else {
				// A bye: the present seed advances unopposed, with no matchup row or comparisons.
				const present = aId ?? bId;

				matchupNodes.push({
					id: `bye-r${round}-s${slot}`,
					round,
					slot,
					a: nodeOf(present),
					b: null,
					winnerSide: present ? "a" : null
				});
				winners.push(present);
			}
		}

		rounds.push({ round, label, short, matchups: matchupNodes });
		slots = winners;
		round += 1;
	}

	return { champion, entrants: seeded.length, rounds, details };
};
