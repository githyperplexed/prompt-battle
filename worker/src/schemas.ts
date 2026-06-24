import { z } from "zod";

// Wire schema sent to the model. Uses plain `z.number()` deliberately: in Zod v4 `.int()`
// emits `minimum`/`maximum` (the safe-integer range) in the JSON schema, which some providers
// (Anthropic via OpenRouter) reject on integer types. The 0–25 integer range is enforced
// after parsing via `clampScore`.
export const scoreSchema = z.object({
	persuasiveness: z.number(),
	originality: z.number(),
	cleverness: z.number(),
	execution: z.number()
});
export type Score = z.infer<typeof scoreSchema>;

export const compareSchema = z.object({
	winner: z.enum(["A", "B"])
});
export type Comparison = z.infer<typeof compareSchema>;
