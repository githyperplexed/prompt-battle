import { generateText, Output } from "ai";

import { model } from "./models";
import { buildCompareMessages, buildScoreMessages } from "./prompts";
import { clampScore, compareSchema, scoreSchema, type Comparison, type Score } from "./schemas";

/** Score one entry in isolation with the given model slug. */
export async function scoreEntry(slug: string, entryText: string): Promise<Score> {
	const { system, user } = buildScoreMessages(entryText);
	const { output } = await generateText({
		model: model(slug),
		system,
		prompt: user,
		output: Output.object({ schema: scoreSchema })
	});
	return clampScore(output);
}

/** Compare two entries head-to-head; returns the preferred positional entry (A or B). */
export async function compareEntries(
	slug: string,
	entryA: string,
	entryB: string
): Promise<Comparison> {
	const { system, user } = buildCompareMessages(entryA, entryB);
	const { output } = await generateText({
		model: model(slug),
		system,
		prompt: user,
		output: Output.object({ schema: compareSchema })
	});
	return output;
}
