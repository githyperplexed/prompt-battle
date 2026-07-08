// Circuit breaker for the auto-disqualify path. A confirmed refusal is evidence about the entry
// only while refusals are rare; many entries failing the same way in one run points at a
// systemic cause (a broken judge prompt or schema, a too-low token cap, a provider output
// regression) that would otherwise mass-disqualify the field and let the contest flip to
// `scored` with nobody in it. Past this threshold a run must disqualify nothing and leave
// every pair retryable. The default allowance is max(floor, share-of-field) — the floor keeps
// a small field from tripping on a handful of genuine refusals; the share scales the allowance
// up for a large one. An operator who has reviewed the reported refusals and judged them
// genuine can replace the threshold for a single run (`score --allow-unscorable <n>`).
export const UNSCORABLE_GUARDRAIL_FLOOR = 5;
export const UNSCORABLE_GUARDRAIL_SHARE = 0.01;

export const exceedsUnscorableGuardrail = (
	unscorableCount: number,
	fieldSize: number,
	allowance?: number
): boolean =>
	unscorableCount >
	(allowance ??
		Math.max(UNSCORABLE_GUARDRAIL_FLOOR, Math.ceil(fieldSize * UNSCORABLE_GUARDRAIL_SHARE)));

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
