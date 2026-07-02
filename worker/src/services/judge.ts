import { capture } from "@latitude-data/telemetry";
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

// Optional Latitude trace context: `functionId` names the trace, `metadata` tags it for filtering
// (contestId, entryId/matchupId, modelId). Absent → the call runs untraced.
export type JudgeTelemetry = {
	functionId: string;
	metadata?: Record<string, string | number | boolean>;
};

const telemetrySettings = (telemetry: JudgeTelemetry | undefined) =>
	telemetry && {
		isEnabled: true,
		recordInputs: true,
		recordOutputs: true,
		functionId: telemetry.functionId
	};

export type JudgeAuditMetadata = {
	requestSettings: JudgeRequestSettings;
	finishReason: string;
	rawFinishReason?: string;
	usage: unknown;
	totalUsage: unknown;
	warnings?: unknown;
	providerMetadata?: unknown;
	// The model's pre-clamp rubric output (score calls only). The stored score is clamped to
	// 0–25 per dimension; without this the published record could not reveal an off-scale model.
	rawOutput?: unknown;
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
	requestSettings: JudgeRequestSettings,
	telemetry?: JudgeTelemetry
): Promise<ScoreResult> => {
	const { system, user, nonce } = buildScoreMessages(prompt, entryText);

	const exec = async () => {
		const result = await generateText({
			model: model(slug),
			messages: buildJudgeMessages(system, user),
			output: Output.object({ schema: scoreSchema }),
			allowSystemInMessages: true,
			experimental_telemetry: telemetrySettings(telemetry),
			...callSettings(requestSettings)
		});

		return {
			score: clampScore(result.output),
			nonce,
			audit: { ...auditMetadata(result, requestSettings), rawOutput: result.output }
		};
	};

	if (!telemetry) return exec();

	return capture(telemetry.functionId, exec, { metadata: telemetry.metadata });
};

export const compareEntries = async (
	slug: string,
	entryA: string,
	entryB: string,
	prompt: PromptSections,
	requestSettings: JudgeRequestSettings,
	telemetry?: JudgeTelemetry
): Promise<ComparisonResult> => {
	const { system, user } = buildCompareMessages(prompt, entryA, entryB);

	const exec = async () => {
		const result = await generateText({
			model: model(slug),
			messages: buildJudgeMessages(system, user),
			output: Output.object({ schema: compareSchema }),
			allowSystemInMessages: true,
			experimental_telemetry: telemetrySettings(telemetry),
			...callSettings(requestSettings)
		});

		return { comparison: result.output, audit: auditMetadata(result, requestSettings) };
	};

	if (!telemetry) return exec();

	return capture(telemetry.functionId, exec, { metadata: telemetry.metadata });
};
