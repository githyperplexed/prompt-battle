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

// precedenceAt = last-edit time (equals publish time when never edited), so an edited entry
// cannot win a tie against the entry it copied — same reset-on-edit rule as the similarity pass.
type Rankable = Aggregate & { id: string; precedenceAt: Date };

// §7.6 order: absolute score, then higher min-model score, then lower variance, then earliest.
// Entry id last: a full tie (possible at YouTube's second-granularity timestamps) must still
// rank deterministically, or a resume could recompute a different field and trip the bracket
// fingerprint check on nothing.
export const rankEntries = <T extends Rankable>(entries: T[]): T[] =>
	[...entries].sort((a, b) => {
		if (b.absoluteScore !== a.absoluteScore) return b.absoluteScore - a.absoluteScore;
		if (b.minModel !== a.minModel) return b.minModel - a.minModel;
		if (a.variance !== b.variance) return a.variance - b.variance;

		const byTime = a.precedenceAt.getTime() - b.precedenceAt.getTime();

		if (byTime !== 0) return byTime;

		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
