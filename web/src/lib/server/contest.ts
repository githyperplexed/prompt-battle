import { and, comparison, count, db, entry, eq, matchup, score } from "$lib/server/database";
import type {
	CompleteData,
	EntryDetail,
	LeaderboardData,
	MatchupDetail,
	ScoringData,
	SearchOutcome,
	SnapshotData,
	VerificationData
} from "$lib/types/contest";
import { judgeLabel } from "$lib/utilities/judges";
import { dqLabel } from "$lib/utilities/labels";
import { aggregateTotals, rankByScore } from "$lib/utilities/ranking";

// Engine constants, mirrored from worker/src/constants.ts.
const BRACKET_SIZE = 64;
export const LEADERBOARD_PAGE_SIZE = 12;

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
		scorePromptHash: config?.prompts?.score?.hash ?? "—",
		comparePromptHash: config?.prompts?.compare?.hash ?? "—",
		keywordHash: config?.keywordHash ?? "—",
		fingerprint,
		judgeSettings: [
			{ key: "max retries", value: String(settings?.maxRetries ?? "—") },
			{ key: "sampling", value: settings?.sampling ?? "—" },
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

export const loadLeaderboard = async (
	contestId: string,
	mode: "top" | "cut",
	page: number
): Promise<LeaderboardData> => {
	const entries = await db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, authorDisplayName: true, channelId: true, publishedAt: true }
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

	const rankable = entries.flatMap((e) => {
		const totals = totalsByEntry.get(e.id);

		if (!totals || totals.length === 0) return [];

		return [
			{
				id: e.id,
				author: e.authorDisplayName,
				channelId: e.channelId,
				publishedAt: e.publishedAt,
				...aggregateTotals(totals)
			}
		];
	});

	const ranked = rankByScore(rankable).map((e, i) => ({
		id: e.id,
		author: e.author,
		channelId: e.channelId,
		score: e.absoluteScore,
		rank: i + 1,
		seed: i < BRACKET_SIZE ? i + 1 : null,
		advancing: i < BRACKET_SIZE
	}));

	const rows =
		mode === "cut"
			? ranked.slice(Math.max(0, BRACKET_SIZE - 4), BRACKET_SIZE + 4)
			: ranked.slice(
					page * LEADERBOARD_PAGE_SIZE,
					page * LEADERBOARD_PAGE_SIZE + LEADERBOARD_PAGE_SIZE
				);

	return {
		rows,
		mode,
		page,
		pageSize: LEADERBOARD_PAGE_SIZE,
		totalEligible: ranked.length,
		cutRank: BRACKET_SIZE
	};
};

export const loadEntryDetail = async (
	contestId: string,
	entryId: string
): Promise<EntryDetail | null> => {
	const contest = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { config: true }
	});

	if (!contest) return null;

	const target = await db.query.entry.findFirst({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.id, entryId)),
		columns: { text: true }
	});

	if (!target) return null;

	const rows = await db
		.select({
			modelId: score.modelId,
			persuasiveness: score.persuasiveness,
			originality: score.originality,
			cleverness: score.cleverness,
			execution: score.execution,
			total: score.total
		})
		.from(score)
		.where(and(eq(score.contestId, contestId), eq(score.entryId, entryId)));

	const byModel = new Map(rows.map((row) => [row.modelId, row]));
	const matrix = panelIdsOf(contest.config).map((id, i) => {
		const row = byModel.get(id);

		return {
			index: i,
			label: judgeLabel(i),
			persuasiveness: row?.persuasiveness ?? 0,
			originality: row?.originality ?? 0,
			cleverness: row?.cleverness ?? 0,
			execution: row?.execution ?? 0,
			total: row?.total ?? 0
		};
	});

	const totals = rows.map((row) => row.total);
	const mean = totals.length ? totals.reduce((sum, t) => sum + t, 0) / totals.length : 0;

	return { comment: target.text, matrix, score: Math.round(mean * 10) / 10 };
};

export const loadComplete = async (contestId: string): Promise<CompleteData> => {
	const contest = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { config: true, bracketFingerprint: true, winnerEntryId: true }
	});

	const config = (contest?.config ?? null) as ContestConfigShape | null;

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
		columns: { id: true, seed: true, authorDisplayName: true }
	});

	const byId = new Map(seeded.map((e) => [e.id, { seed: e.seed, name: e.authorDisplayName }]));

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
				a: byId.get(m.entryAId) ?? null,
				b: byId.get(m.entryBId) ?? null,
				winnerSide:
					m.winnerId === m.entryAId
						? ("a" as const)
						: m.winnerId === m.entryBId
							? ("b" as const)
							: null
			}))
	})).filter((r) => r.matchups.length > 0);

	const verification = buildVerification(config, contest?.bracketFingerprint ?? null);

	return { champion, rounds, verification };
};

export const loadMatchupDetail = async (
	contestId: string,
	matchupId: string
): Promise<MatchupDetail | null> => {
	const m = await db.query.matchup.findFirst({
		where: (x, { and, eq }) => and(eq(x.contestId, contestId), eq(x.id, matchupId)),
		columns: { round: true, entryAId: true, entryBId: true, winnerId: true }
	});

	if (!m) return null;

	const contest = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { config: true }
	});
	const panel = panelIdsOf(contest?.config);

	const ents = await db.query.entry.findMany({
		where: (e, { and, eq, inArray }) =>
			and(eq(e.contestId, contestId), inArray(e.id, [m.entryAId, m.entryBId])),
		columns: { id: true, seed: true, authorDisplayName: true, text: true }
	});
	const byId = new Map(
		ents.map((e) => [e.id, { seed: e.seed, name: e.authorDisplayName, text: e.text }])
	);
	const a = byId.get(m.entryAId) ?? { seed: null, name: "—", text: "" };
	const b = byId.get(m.entryBId) ?? { seed: null, name: "—", text: "" };
	const nameOf = (id: string) => (id === m.entryAId ? a.name : b.name);

	const comps = await db.query.comparison.findMany({
		where: (c, { eq }) => eq(c.matchupId, matchupId),
		columns: { modelId: true, orderSwapped: true, chosenEntryId: true }
	});

	const votes = panel.map((modelId, i) => {
		const aFirst = comps.find((c) => c.modelId === modelId && !c.orderSwapped);
		const bFirst = comps.find((c) => c.modelId === modelId && c.orderSwapped);
		const consistent = !!aFirst && !!bFirst && aFirst.chosenEntryId === bFirst.chosenEntryId;

		return {
			index: i,
			label: judgeLabel(i),
			aFirst: aFirst ? nameOf(aFirst.chosenEntryId) : "—",
			bFirst: bFirst ? nameOf(bFirst.chosenEntryId) : "—",
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
	const winnerName = m.winnerId === m.entryAId ? a.name : m.winnerId === m.entryBId ? b.name : "—";
	const higher = (a.seed ?? Infinity) <= (b.seed ?? Infinity) ? a : b;
	const tail = uncounted > 0 ? ` ${uncounted} vote(s) uncounted for inconsistency.` : "";

	const resolution =
		tallyA === tallyB
			? `Deadlock ${tallyA}–${tallyB} — resolved to the higher seed: #${higher.seed} ${higher.name}.${tail}`
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

export const searchEntry = async (contestId: string, rawQuery: string): Promise<SearchOutcome> => {
	const query = rawQuery.trim();

	if (!contestId || !query) return { kind: "none", query };

	const pattern = `%${query}%`;
	const hit = await db.query.entry.findFirst({
		where: (e, { and, eq, ilike, or }) =>
			and(
				eq(e.contestId, contestId),
				or(ilike(e.authorDisplayName, pattern), ilike(e.channelId, pattern))
			),
		orderBy: (e, { asc }) => asc(e.publishedAt),
		columns: {
			authorDisplayName: true,
			channelId: true,
			text: true,
			status: true,
			dqReason: true,
			rank: true,
			seed: true
		}
	});

	if (!hit) return { kind: "none", query };

	if (hit.status === "eligible") {
		return {
			kind: "eligible",
			author: hit.authorDisplayName,
			channelId: hit.channelId,
			comment: hit.text,
			rank: hit.rank,
			seed: hit.seed
		};
	}

	const reason = hit.dqReason ?? "deleted";
	const redacted = reason === "tos";

	return {
		kind: "disqualified",
		author: hit.authorDisplayName,
		channelId: hit.channelId,
		reason,
		reasonLabel: dqLabel(reason),
		redacted,
		comment: redacted ? null : hit.text
	};
};
