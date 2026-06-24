// Cross-product of entries × models, minus the pairs already scored.
export const buildWorkList = <E extends { id: string }, M extends { id: string }>(
	entries: E[],
	models: M[],
	done: Set<string>
): { entry: E; model: M }[] =>
	entries.flatMap((e) =>
		models.filter((m) => !done.has(`${e.id}:${m.id}`)).map((m) => ({ entry: e, model: m }))
	);
