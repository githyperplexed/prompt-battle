// Cross-product of entries × models, minus the pairs already scored.
export const buildWorkList = <E extends { id: string }, M extends { id: string }>(
	entries: E[],
	models: M[],
	done: Set<string>
): { entry: E; model: M }[] =>
	entries.flatMap((e) =>
		models.filter((m) => !done.has(`${e.id}:${m.id}`)).map((m) => ({ entry: e, model: m }))
	);
type ScorePair = { entryId: string; modelId: string };

export const auditScoreCoverage = <E extends { id: string }, M extends { id: string }>(
	entries: E[],
	models: M[],
	scores: ScorePair[]
) => {
	const entryIds = new Set(entries.map((entry) => entry.id));
	const modelIds = new Set(models.map((model) => model.id));
	const recorded = new Set(scores.map((score) => `${score.entryId}:${score.modelId}`));
	const missing = entries.flatMap((entry) =>
		models
			.filter((model) => !recorded.has(`${entry.id}:${model.id}`))
			.map((model) => ({ entryId: entry.id, modelId: model.id }))
	);
	const unexpected = scores.filter(
		(score) => entryIds.has(score.entryId) && !modelIds.has(score.modelId)
	);

	return { complete: missing.length === 0 && unexpected.length === 0, missing, unexpected };
};
