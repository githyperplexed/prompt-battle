import { generateText, Output } from "ai";

import { compareSchema, scoreSchema, type Comparison, type Score } from "../schemas";
import { buildJudgeMessages } from "../utilities/judge";
import { clampScore } from "../utilities/score";
import { buildCompareMessages, buildScoreMessages } from "./prompts";
import { model } from "./models";

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
