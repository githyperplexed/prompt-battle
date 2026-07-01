import Bottleneck from "bottleneck";
import { z } from "zod";

import type { SimilarityConfig } from "$src/utilities/contest-config";

const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const CHUNK = 100;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_AFTER_MS = 30_000;

const responseSchema = z.object({
	model: z.string().optional(),
	usage: z
		.object({ prompt_tokens: z.number().optional(), total_tokens: z.number().optional() })
		.optional(),
	data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) }))
});

export type EmbeddingAudit = {
	provider: "openai";
	model: string;
	dimensions: number;
	usage?: { promptTokens?: number; totalTokens?: number };
};

export type EmbeddedEntry = {
	entryId: string;
	vector: Float32Array;
	audit: EmbeddingAudit;
	embedding?: string;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | null => {
	if (!value) return null;

	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);

	const date = Date.parse(value);
	if (Number.isNaN(date)) return null;

	return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
};

const shouldRetry = (status: number): boolean => status === 429 || status >= 500;

const retryDelay = (attempt: number, retryAfter: string | null): number => {
	const serverDelay = parseRetryAfter(retryAfter);

	if (serverDelay !== null) return serverDelay;

	return Math.min(500 * 2 ** (attempt - 1), 8_000);
};

const getApiKey = (): string => {
	const apiKey = process.env.OPENAI_API_KEY;

	if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

	return apiKey;
};

const openAiModel = (slug: string): string => slug.replace(/^openai\//, "");

const vectorToBase64 = (vector: Float32Array): string =>
	Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString("base64");

const embedBatch = async (
	texts: string[],
	config: SimilarityConfig,
	apiKey: string
): Promise<{ vectors: Float32Array[]; audit: EmbeddingAudit }> => {
	const model = openAiModel(config.embeddingModel.slug);

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		const res = await fetch(EMBEDDINGS_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ model, input: texts, dimensions: config.embeddingDimensions })
		});

		if (res.ok) {
			const parsed = responseSchema.parse(await res.json());
			const ordered = [...parsed.data].sort((a, b) => a.index - b.index);

			if (ordered.length !== texts.length) {
				throw new Error(
					`Embedding response returned ${ordered.length} vectors for ${texts.length} texts`
				);
			}

			return {
				vectors: ordered.map((item) => new Float32Array(item.embedding)),
				audit: {
					provider: "openai",
					model: parsed.model ?? model,
					dimensions: config.embeddingDimensions,
					usage: parsed.usage
						? {
								promptTokens: parsed.usage.prompt_tokens,
								totalTokens: parsed.usage.total_tokens
							}
						: undefined
				}
			};
		}

		if (!shouldRetry(res.status) || attempt === MAX_ATTEMPTS) {
			throw new Error(`OpenAI embeddings returned HTTP ${res.status}`);
		}

		await sleep(retryDelay(attempt, res.headers.get("retry-after")));
	}

	throw new Error("OpenAI embeddings retry loop exited unexpectedly");
};

export const embedEntries = async (
	entries: { id: string; text: string }[],
	config: SimilarityConfig,
	options: { storeVectors: boolean }
): Promise<Map<string, EmbeddedEntry>> => {
	const apiKey = getApiKey();
	const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 250 });
	const embedded = new Map<string, EmbeddedEntry>();

	try {
		for (let i = 0; i < entries.length; i += CHUNK) {
			const batch = entries.slice(i, i + CHUNK);
			const result = await limiter.schedule(() =>
				embedBatch(
					batch.map((entry) => entry.text),
					config,
					apiKey
				)
			);

			batch.forEach((entry, index) => {
				const vector = result.vectors[index];
				if (!vector) throw new Error(`Missing embedding for entry ${entry.id}`);

				embedded.set(entry.id, {
					entryId: entry.id,
					vector,
					audit: result.audit,
					embedding: options.storeVectors ? vectorToBase64(vector) : undefined
				});
			});
		}
	} finally {
		await limiter.disconnect();
	}

	return embedded;
};
