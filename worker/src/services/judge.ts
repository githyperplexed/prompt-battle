import { generateText, Output } from "ai";

import { compareSchema, scoreSchema, type Comparison, type Score } from "$src/schemas";
import type { JudgeRequestSettings } from "$src/utilities/contest-config";
import { buildJudgeMessages } from "$src/utilities/judge";
import {
	buildCompareMessages,
	buildScoreMessages,
	type PromptSections
} from "$src/utilities/prompts";
import { clampScore } from "$src/utilities/score";
import { model } from "$src/services/models";

export type JudgeAuditMetadata = {
	requestSettings: JudgeRequestSettings;
	finishReason: string;
	rawFinishReason?: string;
	usage: unknown;
	totalUsage: unknown;
	warnings?: unknown;
	providerMetadata?: unknown;
};

type ScoreResult = { score: Score; nonce: string; audit: JudgeAuditMetadata };
type ComparisonResult = { comparison: Comparison; audit: JudgeAuditMetadata };

const auditMetadata = (
	result: Awaited<ReturnType<typeof generateText>>,
	requestSettings: JudgeRequestSettings
): JudgeAuditMetadata => ({
	requestSettings,
	finishReason: result.finishReason,
	rawFinishReason: result.rawFinishReason,
	usage: result.usage,
	totalUsage: result.totalUsage,
	warnings: result.warnings,
	providerMetadata: result.providerMetadata
});

const callSettings = (requestSettings: JudgeRequestSettings) => ({
	maxRetries: requestSettings.maxRetries
});

export const scoreEntry = async (
	slug: string,
	entryText: string,
	prompt: PromptSections,
	requestSettings: JudgeRequestSettings
): Promise<ScoreResult> => {
	const { system, user, nonce } = buildScoreMessages(prompt, entryText);
	const result = await generateText({
		model: model(slug),
		messages: buildJudgeMessages(system, user),
		output: Output.object({ schema: scoreSchema }),
		allowSystemInMessages: true,
		...callSettings(requestSettings)
	});

	return { score: clampScore(result.output), nonce, audit: auditMetadata(result, requestSettings) };
};

export const compareEntries = async (
	slug: string,
	entryA: string,
	entryB: string,
	prompt: PromptSections,
	requestSettings: JudgeRequestSettings
): Promise<ComparisonResult> => {
	const { system, user } = buildCompareMessages(prompt, entryA, entryB);
	const result = await generateText({
		model: model(slug),
		messages: buildJudgeMessages(system, user),
		output: Output.object({ schema: compareSchema }),
		allowSystemInMessages: true,
		...callSettings(requestSettings)
	});

	return { comparison: result.output, audit: auditMetadata(result, requestSettings) };
};
