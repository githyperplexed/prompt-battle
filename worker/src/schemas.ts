import { z } from "zod";

// Wire schema sent to the model. Uses plain `z.number()` deliberately: in Zod v4 `.int()`
// emits `minimum`/`maximum` (the safe-integer range) in the JSON schema, which some providers
// (Anthropic via OpenRouter) reject on integer types. We round + clamp to the 0–25 integer
// range ourselves in `clampScore`.
export const scoreSchema = z.object({
	persuasiveness: z.number(),
	originality: z.number(),
	cleverness: z.number(),
	execution: z.number()
});
export type Score = z.infer<typeof scoreSchema>;

const clampDimension = (n: number) => Math.max(0, Math.min(25, Math.round(n)));

/** Enforce the 0–25 bounds the wire schema can't carry portably across providers. */
export function clampScore(s: Score): Score {
	return {
		persuasiveness: clampDimension(s.persuasiveness),
		originality: clampDimension(s.originality),
		cleverness: clampDimension(s.cleverness),
		execution: clampDimension(s.execution)
	};
}

/** Bracket-phase comparison: which positional entry the model prefers. */
export const compareSchema = z.object({
	winner: z.enum(["A", "B"])
});
export type Comparison = z.infer<typeof compareSchema>;
