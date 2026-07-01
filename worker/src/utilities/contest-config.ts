import { createHash } from "node:crypto";

import { z } from "zod";

import type { PromptSections } from "$src/utilities/prompts";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const canonicalJson = (value: JsonValue): string => {
	if (value === null || typeof value !== "object") return JSON.stringify(value);

	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`)
		.join(",")}}`;
};

export const promptContentHash = (prompt: { system: string; user: string }): string =>
	createHash("sha256").update(prompt.system).update("\0").update(prompt.user).digest("hex");

export const similarityContentHash = (similarity: {
	enabled: boolean;
	embeddingModel: { slug: string };
	preprocessingVersion: 1;
	embeddingDimensions: number;
	cosineThreshold: number;
	lexicalThreshold: number;
	penalty: { mode: "hard_only" | "hard_and_soft"; hardPoints: number; softCoefficient: number };
	hash?: string;
}): string => {
	const { hash: _hash, ...content } = similarity;

	return createHash("sha256")
		.update(canonicalJson(content as JsonValue))
		.digest("hex");
};

const promptSchema = z
	.object({
		system: z.string().min(1),
		user: z.string().min(1),
		hash: z.string().regex(/^[a-f0-9]{64}$/)
	})
	.superRefine((prompt, context) => {
		if (prompt.hash !== promptContentHash(prompt)) {
			context.addIssue({ code: "custom", path: ["hash"], message: "Prompt hash does not match" });
		}
	});

export const panelModelSchema = z.object({
	id: z.string().trim().min(1),
	slug: z
		.string()
		.trim()
		.regex(/^[^/]+\/.+$/, "Model slug must include a provider prefix")
});

export const judgeRequestSettingsSchema = z.object({
	maxRetries: z.number().int().min(0).max(5),
	sampling: z.literal("provider_default")
});

export type JudgeRequestSettings = z.infer<typeof judgeRequestSettingsSchema>;

export const defaultJudgeRequestSettings: JudgeRequestSettings = {
	maxRetries: 2,
	sampling: "provider_default"
};

export const similarityConfigSchema = z
	.object({
		enabled: z.boolean(),
		embeddingModel: z.object({ slug: z.string().trim().min(1) }),
		preprocessingVersion: z.literal(1),
		embeddingDimensions: z.number().int().min(64).max(3072),
		cosineThreshold: z.number().min(0).max(1),
		lexicalThreshold: z.number().min(0).max(1),
		penalty: z.object({
			mode: z.enum(["hard_only", "hard_and_soft"]),
			hardPoints: z.number().min(0).max(25),
			softCoefficient: z.number().min(0).max(25)
		}),
		hash: z.string().regex(/^[a-f0-9]{64}$/)
	})
	.superRefine((similarity, context) => {
		if (similarity.hash !== similarityContentHash(similarity)) {
			context.addIssue({
				code: "custom",
				path: ["hash"],
				message: "Similarity hash does not match"
			});
		}
	});

export type SimilarityConfig = z.infer<typeof similarityConfigSchema>;
export type UnpinnedSimilarityConfig = Omit<SimilarityConfig, "hash">;

export const defaultSimilarityConfig: UnpinnedSimilarityConfig = {
	enabled: true,
	embeddingModel: { slug: "openai/text-embedding-3-small" },
	preprocessingVersion: 1,
	embeddingDimensions: 256,
	cosineThreshold: 0.92,
	lexicalThreshold: 0.6,
	penalty: { mode: "hard_only", hardPoints: 25, softCoefficient: 0 }
};

export const panelSchema = z
	.array(panelModelSchema)
	.length(3)
	.superRefine((panel, context) => {
		const ids = panel.map((model) => model.id);
		const slugs = panel.map((model) => model.slug);
		const providers = panel.map((model) => model.slug.split("/")[0]!.toLowerCase());

		for (const [path, values, label] of [
			["id", ids, "model ids"],
			["slug", slugs, "model slugs"],
			["slug", providers, "model providers"]
		] as const) {
			if (new Set(values).size !== panel.length) {
				context.addIssue({
					code: "custom",
					path: [path],
					message: `Panel must use distinct ${label}`
				});
			}
		}
	});

export const contestConfigSchema = z.object({
	version: z.literal(2),
	keywordHash: z.string().regex(/^[a-f0-9]{64}$/),
	panel: panelSchema,
	prompts: z.object({ score: promptSchema, compare: promptSchema }),
	judge: z.object({ requestSettings: judgeRequestSettingsSchema }),
	similarity: similarityConfigSchema,
	revealed: z.object({ keywords: z.array(z.string()), salt: z.string() }).optional()
});

export type PromptTemplate = z.infer<typeof promptSchema>;
export type ContestConfig = z.infer<typeof contestConfigSchema>;
export type PanelModel = z.infer<typeof panelModelSchema>;

type UnpinnedPrompt = PromptSections;

export const pinSimilarityConfig = (similarity: UnpinnedSimilarityConfig): SimilarityConfig =>
	similarityConfigSchema.parse({ ...similarity, hash: similarityContentHash(similarity) });

export const createContestConfig = (input: {
	keywordHash: string;
	panel: PanelModel[];
	prompts: { score: UnpinnedPrompt; compare: UnpinnedPrompt };
	judge?: { requestSettings: JudgeRequestSettings };
	similarity?: UnpinnedSimilarityConfig;
}): ContestConfig =>
	contestConfigSchema.parse({
		version: 2,
		keywordHash: input.keywordHash,
		panel: input.panel,
		prompts: {
			score: { ...input.prompts.score, hash: promptContentHash(input.prompts.score) },
			compare: { ...input.prompts.compare, hash: promptContentHash(input.prompts.compare) }
		},
		judge: input.judge ?? { requestSettings: defaultJudgeRequestSettings },
		similarity: pinSimilarityConfig(input.similarity ?? defaultSimilarityConfig)
	});

export const parseContestConfig = (value: unknown): ContestConfig =>
	contestConfigSchema.parse(value);
