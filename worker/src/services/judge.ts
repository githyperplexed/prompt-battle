import { generateText, Output } from "ai";

import { compareSchema, scoreSchema, type Comparison, type Score } from "$src/schemas";
import { buildJudgeMessages } from "$src/utilities/judge";
import {
	buildCompareMessages,
	buildScoreMessages,
	type PromptSections
} from "$src/utilities/prompts";
import { clampScore } from "$src/utilities/score";
import { model } from "$src/services/models";

export const scoreEntry = async (
	slug: string,
	entryText: string,
	prompt: PromptSections
): Promise<{ score: Score; nonce: string }> => {
	const { system, user, nonce } = buildScoreMessages(prompt, entryText);
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
	entryB: string,
	prompt: PromptSections
): Promise<Comparison> => {
	const { system, user } = buildCompareMessages(prompt, entryA, entryB);
	const { output } = await generateText({
		model: model(slug),
		messages: buildJudgeMessages(system, user),
		output: Output.object({ schema: compareSchema }),
		allowSystemInMessages: true
	});

	return output;
};
