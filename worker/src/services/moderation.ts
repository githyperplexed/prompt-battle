import Bottleneck from "bottleneck";
import { z } from "zod";

import { packBatches } from "$src/utilities/batching";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
// omni-moderation is capped at 10,000 tokens/min on OpenAI's tier 1. 6,000 chars is
// ~1,500–3,000 tokens even for token-dense text, so 3 batches/min stays under the cap
// with headroom; a batch above the cap would never succeed no matter the retries.
const MAX_BATCH_CHARS = 6_000;
const MAX_BATCH_COUNT = 50;
const BATCH_INTERVAL_MS = 20_000;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_AFTER_MS = 90_000;

const responseSchema = z.object({
	results: z.array(z.object({ flagged: z.boolean() }))
});

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

// Without a Retry-After header the delay must be able to outlast a full per-minute
// rate-limit window, or every retry lands inside the same exhausted window.
const retryDelay = (attempt: number, retryAfter: string | null): number => {
	const serverDelay = parseRetryAfter(retryAfter);

	if (serverDelay !== null) return serverDelay;

	return Math.min(15_000 * 2 ** (attempt - 1), MAX_RETRY_AFTER_MS);
};

const getApiKey = (): string => {
	const apiKey = process.env.OPENAI_API_KEY;

	if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

	return apiKey;
};

const moderateBatch = async (texts: string[], apiKey: string): Promise<boolean[]> => {
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		const res = await fetch(MODERATION_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ model: "omni-moderation-latest", input: texts })
		});

		if (res.ok) {
			const parsed = responseSchema.parse(await res.json());

			// A short response would silently pass the unmatched tail as unflagged.
			if (parsed.results.length !== texts.length) {
				throw new Error(
					`OpenAI moderation returned ${parsed.results.length} results for ${texts.length} inputs`
				);
			}

			return parsed.results.map((result) => result.flagged);
		}

		if (!shouldRetry(res.status) || attempt === MAX_ATTEMPTS) {
			throw new Error(`OpenAI moderation returned HTTP ${res.status}`);
		}

		await sleep(retryDelay(attempt, res.headers.get("retry-after")));
	}

	throw new Error("OpenAI moderation retry loop exited unexpectedly");
};

// Returns a `flagged` boolean per input text, aligned to input order; batched to keep the
// request count down.
export const flagViolations = async (texts: string[]): Promise<boolean[]> => {
	const apiKey = getApiKey();
	const limiter = new Bottleneck({ maxConcurrent: 1, minTime: BATCH_INTERVAL_MS });
	const flags: boolean[] = [];

	try {
		for (const batch of packBatches(texts, MAX_BATCH_CHARS, MAX_BATCH_COUNT)) {
			const batchFlags = await limiter.schedule(() => moderateBatch(batch, apiKey));

			flags.push(...batchFlags);
		}
	} finally {
		await limiter.disconnect();
	}

	return flags;
};
