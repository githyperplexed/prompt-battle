import Bottleneck from "bottleneck";

import { comparison, contest, db, entry, eq, matchup, score, sql } from "@prompt-battle/db";

import { BRACKET_SIZE } from "$src/constants";
import { parseContestConfig, type ContestConfig } from "$src/utilities/contest-config";
import {
	assertMatchupEntry,
	bracketFingerprint,
	nextPowerOfTwo,
	seedOrder,
	tallyMatchup
} from "$src/utilities/bracket";
import { aggregateTotals, rankEntries } from "$src/utilities/ranking";
import { compareEntries } from "$src/services/judge";
import { withContestLock } from "$src/services/locks";

const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });
const RESULT_CHUNK = 50;

type Seeded = {
	id: string;
	seed: number;
	rank: number;
	absoluteScore: number;
	text: string;
};

type RankedEntry = {
	id: string;
	text: string;
	absoluteScore: number;
	rank: number;
	seed: number | null;
};

const persistRankings = async (rows: RankedEntry[]) => {
	for (let i = 0; i < rows.length; i += RESULT_CHUNK) {
		await Promise.all(
			rows
				.slice(i, i + RESULT_CHUNK)
				.map((r) =>
					db
						.update(entry)
						.set({ absoluteScore: r.absoluteScore, rank: r.rank, seed: r.seed })
						.where(eq(entry.id, r.id))
				)
		);
	}
};

const loadRankedField = async (
	contestId: string
): Promise<{ ranked: RankedEntry[]; seeded: Seeded[]; fingerprint: string }> => {
	const entries = await db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, text: true, publishedAt: true }
	});

	const scores = await db
		.select({ entryId: score.entryId, total: score.total })
		.from(score)
		.where(eq(score.contestId, contestId));

	const totalsByEntry = new Map<string, number[]>();

	for (const s of scores) {
		const list = totalsByEntry.get(s.entryId) ?? [];
		list.push(s.total);
		totalsByEntry.set(s.entryId, list);
	}

	const rankable = entries.flatMap((e) => {
		const totals = totalsByEntry.get(e.id);

		if (!totals || totals.length === 0) return [];

		return [{ id: e.id, text: e.text, publishedAt: e.publishedAt, ...aggregateTotals(totals) }];
	});

	const ranked = rankEntries(rankable).map((e, i) => ({
		id: e.id,
		text: e.text,
		absoluteScore: e.absoluteScore,
		rank: i + 1,
		seed: i < BRACKET_SIZE ? i + 1 : null
	}));
	const seeded = ranked.slice(0, BRACKET_SIZE).map((e) => ({
		id: e.id,
		seed: e.seed ?? e.rank,
		rank: e.rank,
		absoluteScore: e.absoluteScore,
		text: e.text
	}));
	const fingerprint = bracketFingerprint(seeded);

	return { ranked, seeded, fingerprint };
};

const ensureBracketFingerprint = async (contestId: string, fingerprint: string) =>
	db.transaction(async (tx) => {
		await tx.execute(sql`select 1 from ${contest} where ${contest.id} = ${contestId} for update`);

		const target = await tx.query.contest.findFirst({
			where: (c, { eq }) => eq(c.id, contestId),
			columns: { id: true, status: true, bracketFingerprint: true }
		});

		if (!target) throw new Error(`No contest with id ${contestId}`);

		if (target.status !== "scored") {
			return { skipped: true as const, status: target.status };
		}

		if (target.bracketFingerprint === fingerprint) {
			return { skipped: false as const };
		}

		if (target.bracketFingerprint) {
			throw new Error(
				`Bracket fingerprint mismatch for contest ${contestId}. Stored ${target.bracketFingerprint}, computed ${fingerprint}. See RUNBOOK.md "Recovering from bracket fingerprint mismatch" before continuing.`
			);
		}

		const existingMatchup = await tx.query.matchup.findFirst({
			where: (m, { eq }) => eq(m.contestId, contestId),
			columns: { id: true }
		});

		if (existingMatchup) {
			throw new Error(
				`Contest ${contestId} has bracket rows but no bracket fingerprint. Run reset --contest ${contestId} --to scored if those rows are private/bad, or restore the original bracket state before continuing.`
			);
		}

		await tx
			.update(contest)
			.set({ bracketFingerprint: fingerprint })
			.where(eq(contest.id, contestId));

		return { skipped: false as const };
	});

const getOrCreateMatchup = async (
	contestId: string,
	round: number,
	slot: number,
	entryAId: string,
	entryBId: string
) => {
	const existing = await db.query.matchup.findFirst({
		where: (m, { and, eq }) =>
			and(eq(m.contestId, contestId), eq(m.round, round), eq(m.slot, slot)),
		columns: { id: true, winnerId: true }
	});

	if (existing) return existing;

	await db
		.insert(matchup)
		.values({ contestId, round, slot, entryAId, entryBId })
		.onConflictDoNothing();

	const created = await db.query.matchup.findFirst({
		where: (m, { and, eq }) =>
			and(eq(m.contestId, contestId), eq(m.round, round), eq(m.slot, slot)),
		columns: { id: true, winnerId: true }
	});

	if (!created) throw new Error(`Failed to create matchup ${contestId} r${round} s${slot}`);

	return created;
};

const resolveMatchup = async (
	contestId: string,
	round: number,
	slot: number,
	a: string | null,
	b: string | null,
	seedOfId: Map<string, number>,
	textOfId: Map<string, string>,
	config: ContestConfig
): Promise<string | null> => {
	// A bye: the present side auto-advances with no matchup row or comparisons.
	if (!a) return b;
	if (!b) return a;

	// entryA is the higher seed (lower seed number); deadlocks resolve to it.
	const [entryA, entryB] = (seedOfId.get(a) ?? 0) <= (seedOfId.get(b) ?? 0) ? [a, b] : [b, a];

	const row = await getOrCreateMatchup(contestId, round, slot, entryA, entryB);

	if (row.winnerId) {
		assertMatchupEntry(entryA, entryB, row.winnerId, "Stored winnerId");
		return row.winnerId;
	}

	const textA = textOfId.get(entryA);
	const textB = textOfId.get(entryB);

	if (!textA || !textB) throw new Error(`Missing entry text for matchup ${row.id}`);

	const recorded = await db.query.comparison.findMany({
		where: (c, { eq }) => eq(c.matchupId, row.id),
		columns: { modelId: true, orderSwapped: true, chosenEntryId: true }
	});

	for (const c of recorded) {
		assertMatchupEntry(entryA, entryB, c.chosenEntryId, "Recorded chosenEntryId");
	}

	const doneKeys = new Set(recorded.map((c) => `${c.modelId}:${c.orderSwapped}`));

	const pending = config.panel.flatMap((m) =>
		[false, true]
			.filter((orderSwapped) => !doneKeys.has(`${m.id}:${orderSwapped}`))
			.map((orderSwapped) => ({ model: m, orderSwapped }))
	);

	const fresh = await Promise.all(
		pending.map((p) =>
			limiter.schedule(async () => {
				const [first, second] = p.orderSwapped ? [textB, textA] : [textA, textB];
				const { comparison: verdict, audit } = await compareEntries(
					p.model.slug,
					first,
					second,
					config.prompts.compare,
					config.judge.requestSettings
				);

				// "A" is whichever entry was presented first; map back to the canonical entry.
				const firstEntry = p.orderSwapped ? entryB : entryA;
				const secondEntry = p.orderSwapped ? entryA : entryB;
				const chosenEntryId = verdict.winner === "A" ? firstEntry : secondEntry;
				assertMatchupEntry(entryA, entryB, chosenEntryId, "Fresh chosenEntryId");

				await db
					.insert(comparison)
					.values({
						matchupId: row.id,
						modelId: p.model.id,
						orderSwapped: p.orderSwapped,
						chosenEntryId,
						audit
					})
					.onConflictDoNothing();

				return { modelId: p.model.id, chosenEntryId };
			})
		)
	);

	const votes = [
		...recorded.map((c) => ({ modelId: c.modelId, chosenEntryId: c.chosenEntryId })),
		...fresh
	];

	const winner = tallyMatchup(entryA, entryB, votes);
	assertMatchupEntry(entryA, entryB, winner, "Resolved winnerId");

	await db.update(matchup).set({ winnerId: winner }).where(eq(matchup.id, row.id));

	return winner;
};

const runBracket = async (contestId: string, seeded: Seeded[], config: ContestConfig) => {
	const order = seedOrder(nextPowerOfTwo(seeded.length));
	const idBySeed = new Map(seeded.map((s) => [s.seed, s.id]));
	const seedOfId = new Map(seeded.map((s) => [s.id, s.seed]));
	const textOfId = new Map(seeded.map((s) => [s.id, s.text]));

	let slots: (string | null)[] = order.map((seed) => idBySeed.get(seed) ?? null);
	const eliminatedRound = new Map<string, number>();
	let round = 1;

	while (slots.length > 1) {
		const pairs = [];

		for (let i = 0; i < slots.length; i += 2) {
			pairs.push({ a: slots[i] ?? null, b: slots[i + 1] ?? null, slot: i / 2 });
		}

		const winners = await Promise.all(
			pairs.map((p) =>
				resolveMatchup(contestId, round, p.slot, p.a, p.b, seedOfId, textOfId, config)
			)
		);

		pairs.forEach((p, idx) => {
			const winner = winners[idx];

			if (p.a && p.b && winner) eliminatedRound.set(winner === p.a ? p.b : p.a, round);
		});

		slots = winners;
		round += 1;
	}

	return { champion: slots[0] ?? null, eliminatedRound, rounds: round - 1 };
};

const finalize = async (
	contestId: string,
	champion: string | null,
	eliminatedRound: Map<string, number>,
	rounds: number
) => {
	const finalRounds = [...eliminatedRound].map(([id, finalRound]) => ({ id, finalRound }));

	if (champion) finalRounds.push({ id: champion, finalRound: rounds });

	for (let i = 0; i < finalRounds.length; i += RESULT_CHUNK) {
		await Promise.all(
			finalRounds
				.slice(i, i + RESULT_CHUNK)
				.map((r) => db.update(entry).set({ finalRound: r.finalRound }).where(eq(entry.id, r.id)))
		);
	}

	await db
		.update(contest)
		.set({ winnerEntryId: champion, status: "complete" })
		.where(eq(contest.id, contestId));
};

export const advanceContest = async (contestId: string) =>
	withContestLock(contestId, async () => {
		const target = await db.query.contest.findFirst({
			where: (c, { eq }) => eq(c.id, contestId),
			columns: { id: true, status: true, config: true }
		});

		if (!target) throw new Error(`No contest with id ${contestId}`);

		const config = parseContestConfig(target.config);

		if (target.status !== "scored") {
			return { skipped: true as const, status: target.status };
		}

		const { ranked, seeded, fingerprint } = await loadRankedField(contestId);
		const bracket = await ensureBracketFingerprint(contestId, fingerprint);

		if (bracket.skipped) return bracket;

		await persistRankings(ranked);

		try {
			const { champion, eliminatedRound, rounds } = await runBracket(contestId, seeded, config);

			await finalize(contestId, champion, eliminatedRound, rounds);

			return { skipped: false as const, entrants: seeded.length, rounds, champion, fingerprint };
		} finally {
			await limiter.disconnect();
		}
	});
