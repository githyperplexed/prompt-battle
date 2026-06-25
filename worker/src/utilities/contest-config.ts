import { createHash } from "node:crypto";

import { z } from "zod";

import type { PromptSections } from "$src/utilities/prompts";

export const promptContentHash = (prompt: { system: string; user: string }): string =>
	createHash("sha256").update(prompt.system).update("\0").update(prompt.user).digest("hex");

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
	version: z.literal(1),
	keywordHash: z.string().regex(/^[a-f0-9]{64}$/),
	panel: panelSchema,
	prompts: z.object({ score: promptSchema, compare: promptSchema }),
	judge: z.object({ requestSettings: judgeRequestSettingsSchema })
});

export type PromptTemplate = z.infer<typeof promptSchema>;
export type ContestConfig = z.infer<typeof contestConfigSchema>;
export type PanelModel = z.infer<typeof panelModelSchema>;

type UnpinnedPrompt = PromptSections;

export const createContestConfig = (input: {
	keywordHash: string;
	panel: PanelModel[];
	prompts: { score: UnpinnedPrompt; compare: UnpinnedPrompt };
	judge?: { requestSettings: JudgeRequestSettings };
}): ContestConfig =>
	contestConfigSchema.parse({
		version: 1,
		keywordHash: input.keywordHash,
		panel: input.panel,
		prompts: {
			score: { ...input.prompts.score, hash: promptContentHash(input.prompts.score) },
			compare: { ...input.prompts.compare, hash: promptContentHash(input.prompts.compare) }
		},
		judge: input.judge ?? { requestSettings: defaultJudgeRequestSettings }
	});

export const parseContestConfig = (value: unknown): ContestConfig =>
	contestConfigSchema.parse(value);
