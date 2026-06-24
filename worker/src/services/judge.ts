import { generateText, Output } from "ai";

import { compareSchema, scoreSchema, type Comparison, type Score } from "../schemas";
import { clampScore } from "../utilities/score";
import { buildCompareMessages, buildScoreMessages } from "./prompts";
import { model } from "./models";

export const scoreEntry = async (slug: string, entryText: string): Promise<Score> => {
	const { system, user } = buildScoreMessages(entryText);
	const { output } = await generateText({
		model: model(slug),
		system,
		prompt: user,
		output: Output.object({ schema: scoreSchema })
	});

	return clampScore(output);
};

export const compareEntries = async (
	slug: string,
	entryA: string,
	entryB: string
): Promise<Comparison> => {
	const { system, user } = buildCompareMessages(entryA, entryB);
	const { output } = await generateText({
		model: model(slug),
		system,
		prompt: user,
		output: Output.object({ schema: compareSchema })
	});

	return output;
};
