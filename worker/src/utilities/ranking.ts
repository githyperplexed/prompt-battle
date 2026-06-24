type Aggregate = { absoluteScore: number; minModel: number; variance: number };

export const aggregateTotals = (totals: number[]): Aggregate => {
	const mean = totals.reduce((sum, t) => sum + t, 0) / totals.length;
	const variance = totals.reduce((sum, t) => sum + (t - mean) ** 2, 0) / totals.length;

	return {
		absoluteScore: Math.round(mean * 10) / 10,
		minModel: Math.min(...totals),
		variance
	};
};

type Rankable = Aggregate & { id: string; publishedAt: Date };

// §7.6 order: absolute score, then higher min-model score, then lower variance, then earliest.
export const rankEntries = <T extends Rankable>(entries: T[]): T[] =>
	[...entries].sort((a, b) => {
		if (b.absoluteScore !== a.absoluteScore) return b.absoluteScore - a.absoluteScore;
		if (b.minModel !== a.minModel) return b.minModel - a.minModel;
		if (a.variance !== b.variance) return a.variance - b.variance;

		return a.publishedAt.getTime() - b.publishedAt.getTime();
	});
