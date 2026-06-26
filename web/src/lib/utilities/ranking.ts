// Mirrors the worker's rules.md §7.6 ranking so the pre-bracket leaderboard matches the seeding
// `advance` will later produce. Kept in sync with worker/src/utilities/ranking.ts by hand (web
// can't import the worker package); change both together.
export type Aggregate = { absoluteScore: number; minModel: number; variance: number };

export const aggregateTotals = (totals: number[]): Aggregate => {
	const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length;
	const variance = totals.reduce((sum, total) => sum + (total - mean) ** 2, 0) / totals.length;

	return { absoluteScore: Math.round(mean * 10) / 10, minModel: Math.min(...totals), variance };
};

// Absolute score, then higher min-model score, then lower variance, then earliest snapshot.
export const rankByScore = <T extends Aggregate & { publishedAt: Date }>(entries: T[]): T[] =>
	[...entries].sort((a, b) => {
		if (b.absoluteScore !== a.absoluteScore) return b.absoluteScore - a.absoluteScore;
		if (b.minModel !== a.minModel) return b.minModel - a.minModel;
		if (a.variance !== b.variance) return a.variance - b.variance;

		return a.publishedAt.getTime() - b.publishedAt.getTime();
	});
