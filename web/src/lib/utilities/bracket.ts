// Pure bracket-seeding helpers, mirrored from worker/src/utilities/bracket.ts. The web layer uses
// them to reconstruct the full seeded field (including the byes the worker never stores as matchup
// rows) so the bracket can be drawn as a complete binary tree.

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
