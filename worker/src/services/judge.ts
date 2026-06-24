import { generateText, Output } from "ai";

import { compareSchema, scoreSchema, type Comparison, type Score } from "$src/schemas";
import { buildJudgeMessages } from "$src/utilities/judge";
import { clampScore } from "$src/utilities/score";
import { buildCompareMessages, buildScoreMessages } from "$src/services/prompts";
import { model } from "$src/services/models";

export const scoreEntry = async (
	slug: string,
	entryText: string
): Promise<{ score: Score; nonce: string }> => {
	const { system, user, nonce } = buildScoreMessages(entryText);
	const { output } = await generateText({
		model: model(slug),
		messages: buildJudgeMessages(system, user),
		output: Output.object({ schema: scoreSchema }),
		allowSystemInMessages: true
	});

	return { score: clampScore(output), nonce };
};

export const compareEntries = async (
	slug: string,
	entryA: string,
	entryB: string
): Promise<Comparison> => {
	const { system, user } = buildCompareMessages(entryA, entryB);
	const { output } = await generateText({
		model: model(slug),
		messages: buildJudgeMessages(system, user),
		output: Output.object({ schema: compareSchema }),
		allowSystemInMessages: true
	});

	return output;
};
