import { describe, expect, test } from "bun:test";

import { defaultPanel } from "../src/services/config";
import { defaultPromptTemplates } from "../src/services/prompts";

import {
	createContestConfig,
	parseContestConfig,
	promptContentHash,
	similarityContentHash
} from "../src/utilities/contest-config";

const panel = [
	{ id: "openai", slug: "openai/model" },
	{ id: "anthropic", slug: "anthropic/model" },
	{ id: "google", slug: "google/model" }
];
const prompts = {
	score: { system: "score system", user: "score user" },
	compare: { system: "compare system", user: "compare user" }
};
const keywordHash = "a".repeat(64);

describe("contest config", () => {
	test("accepts the repository defaults for new contests", () => {
		expect(() =>
			createContestConfig({
				keywordHash,
				panel: defaultPanel,
				prompts: defaultPromptTemplates
			})
		).not.toThrow();
	});

	test("creates a versioned config with pinned prompt hashes", () => {
		const config = createContestConfig({ keywordHash, panel, prompts });

		expect(config.version).toBe(2);
		expect(config.prompts.score.hash).toBe(promptContentHash(prompts.score));
		expect(config.judge.requestSettings).toEqual({ maxRetries: 2, sampling: "provider_default" });
		expect(config.similarity.hash).toBe(similarityContentHash(config.similarity));
		expect(parseContestConfig(config)).toEqual(config);
	});

	test("requires exactly three panel models", () => {
		expect(() => createContestConfig({ keywordHash, panel: panel.slice(0, 2), prompts })).toThrow();
	});

	test("rejects duplicate model ids", () => {
		const duplicateIds = panel.map((model) => ({ ...model }));
		duplicateIds[1]!.id = duplicateIds[0]!.id;

		expect(() => createContestConfig({ keywordHash, panel: duplicateIds, prompts })).toThrow();
	});

	test("rejects multiple models from the same provider", () => {
		const duplicateProviders = panel.map((model) => ({ ...model }));
		duplicateProviders[1]!.slug = "openai/other-model";

		expect(() =>
			createContestConfig({ keywordHash, panel: duplicateProviders, prompts })
		).toThrow();
	});

	test("rejects prompt text that does not match its pinned hash", () => {
		const config = createContestConfig({ keywordHash, panel, prompts });

		expect(() =>
			parseContestConfig({
				...config,
				prompts: { ...config.prompts, score: { ...config.prompts.score, user: "tampered" } }
			})
		).toThrow();
	});
});

test("rejects similarity config that does not match its pinned hash", () => {
	const config = createContestConfig({ keywordHash, panel, prompts });

	expect(() =>
		parseContestConfig({
			...config,
			similarity: { ...config.similarity, cosineThreshold: 0.1 }
		})
	).toThrow();
});
