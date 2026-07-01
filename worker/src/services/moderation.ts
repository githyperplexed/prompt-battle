import Bottleneck from "bottleneck";
import { z } from "zod";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const CHUNK = 50;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_AFTER_MS = 30_000;

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

const moderateBatch = async (texts: string[], apiKey: string): Promise<boolean[]> => {
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		const res = await fetch(MODERATION_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ model: "omni-moderation-latest", input: texts })
		});

		if (res.ok) {
			const parsed = responseSchema.parse(await res.json());

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
	const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 1000 });
	const flags: boolean[] = [];

	try {
		for (let i = 0; i < texts.length; i += CHUNK) {
			const batchFlags = await limiter.schedule(() =>
				moderateBatch(texts.slice(i, i + CHUNK), apiKey)
			);

			flags.push(...batchFlags);
		}
	} finally {
		await limiter.disconnect();
	}

	return flags;
};
