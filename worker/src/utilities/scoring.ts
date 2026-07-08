// A judge call that produces no schema-valid output (the AI SDK's NoOutputGeneratedError) is a
// content-driven refusal, not a transient network failure — the model declined rather than the
// request failing to reach it. Only this class of failure makes an entry unscorable; anything
// else (timeouts, 429s, 5xx) stays retryable and must not disqualify an innocent entry.
export const isNoOutputError = (err: unknown): boolean => {
	const name = (err as { name?: unknown } | null)?.name;

	return name === "AI_NoOutputGeneratedError" || name === "NoOutputGeneratedError";
};

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
