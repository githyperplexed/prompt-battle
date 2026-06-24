import type { Score } from "$src/schemas";

const clampDimension = (n: number) => Math.max(0, Math.min(25, Math.round(n)));

export const clampScore = (s: Score): Score => ({
	persuasiveness: clampDimension(s.persuasiveness),
	originality: clampDimension(s.originality),
	cleverness: clampDimension(s.cleverness),
	execution: clampDimension(s.execution)
});
