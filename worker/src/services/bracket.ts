import Bottleneck from "bottleneck";

import { comparison, contest, db, entry, eq, matchup, score } from "@prompt-battle/db";

import { BRACKET_SIZE } from "$src/constants";
import { parseContestConfig, type ContestConfig } from "$src/utilities/contest-config";
import { nextPowerOfTwo, seedOrder, tallyMatchup } from "$src/utilities/bracket";
import { aggregateTotals, rankEntries } from "$src/utilities/ranking";
import { compareEntries } from "$src/services/judge";

const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 200 });
const RESULT_CHUNK = 50;

type Seeded = { id: string; seed: number; text: string };

const persistRankings = async (
	rows: { id: string; absoluteScore: number; rank: number; seed: number | null }[]
) => {
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

const rankAndSeed = async (contestId: string): Promise<Seeded[]> => {
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

	const ranked = rankEntries(rankable);

	await persistRankings(
		ranked.map((e, i) => ({
			id: e.id,
			absoluteScore: e.absoluteScore,
			rank: i + 1,
			seed: i < BRACKET_SIZE ? i + 1 : null
		}))
	);

	return ranked.slice(0, BRACKET_SIZE).map((e, i) => ({ id: e.id, seed: i + 1, text: e.text }));
};

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

	if (row.winnerId) return row.winnerId;

	const textA = textOfId.get(entryA);
	const textB = textOfId.get(entryB);

	if (!textA || !textB) throw new Error(`Missing entry text for matchup ${row.id}`);

	const recorded = await db.query.comparison.findMany({
		where: (c, { eq }) => eq(c.matchupId, row.id),
		columns: { modelId: true, orderSwapped: true, chosenEntryId: true }
	});

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
				const verdict = await compareEntries(p.model.slug, first, second, config.prompts.compare);

				// "A" is whichever entry was presented first; map back to the canonical entry.
				const firstEntry = p.orderSwapped ? entryB : entryA;
				const secondEntry = p.orderSwapped ? entryA : entryB;
				const chosenEntryId = verdict.winner === "A" ? firstEntry : secondEntry;

				await db
					.insert(comparison)
					.values({
						matchupId: row.id,
						modelId: p.model.id,
						orderSwapped: p.orderSwapped,
						chosenEntryId
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

export const advanceContest = async (contestId: string) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { id: true, status: true, config: true }
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	const config = parseContestConfig(target.config);

	if (target.status !== "scored") {
		return { skipped: true as const, status: target.status };
	}

	const seeded = await rankAndSeed(contestId);
	const { champion, eliminatedRound, rounds } = await runBracket(contestId, seeded, config);

	await finalize(contestId, champion, eliminatedRound, rounds);
	await limiter.disconnect();

	return { skipped: false as const, entrants: seeded.length, rounds, champion };
};
