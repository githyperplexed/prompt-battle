import { createHash } from "node:crypto";

export const nextPowerOfTwo = (n: number): number => {
	let size = 1;

	while (size < n) size *= 2;

	return size;
};

// Top-to-bottom seed positions for a full bracket, arranged so #1 and #2 can only meet in
// the final. e.g. size 8 -> [1, 8, 4, 5, 2, 7, 3, 6]; round-1 matchups are consecutive pairs.
export const seedOrder = (size: number): number[] => {
	let seeds = [1];

	while (seeds.length < size) {
		const round = seeds.length * 2;
		const next: number[] = [];

		for (const seed of seeds) next.push(seed, round + 1 - seed);

		seeds = next;
	}

	return seeds;
};

export type BracketFingerprintSeed = {
	id: string;
	rank: number;
	seed: number;
	absoluteScore: number;
};

export const bracketFingerprint = (seeded: BracketFingerprintSeed[]): string => {
	const payload = seeded.map((entry) => ({
		id: entry.id,
		rank: entry.rank,
		seed: entry.seed,
		absoluteScore: entry.absoluteScore
	}));

	return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

type Vote = { modelId: string; chosenEntryId: string };

export const assertMatchupEntry = (
	entryA: string,
	entryB: string,
	entryId: string,
	label: string
): void => {
	if (entryId !== entryA && entryId !== entryB) {
		throw new Error(`${label} ${entryId} is not part of matchup (${entryA}, ${entryB})`);
	}
};

// A model's vote counts only if it chose the same entry in both orderings; majority wins.
// A deadlock goes to entryA, which the caller passes as the higher seed.
export const tallyMatchup = (entryA: string, entryB: string, votes: Vote[]): string => {
	const choicesByModel = new Map<string, Set<string>>();

	for (const vote of votes) {
		const choices = choicesByModel.get(vote.modelId) ?? new Set<string>();
		choices.add(vote.chosenEntryId);
		choicesByModel.set(vote.modelId, choices);
	}

	let aVotes = 0;
	let bVotes = 0;

	for (const choices of choicesByModel.values()) {
		if (choices.size !== 1) continue;

		if (choices.has(entryA)) aVotes += 1;
		else if (choices.has(entryB)) bVotes += 1;
	}

	return bVotes > aVotes ? entryB : entryA;
};
