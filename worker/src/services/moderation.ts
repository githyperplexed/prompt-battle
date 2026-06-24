import { z } from "zod";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const CHUNK = 50;

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

const responseSchema = z.object({
	results: z.array(z.object({ flagged: z.boolean() }))
});

// Returns a `flagged` boolean per input text, aligned to input order; batched to keep the
// request count down.
export const flagViolations = async (texts: string[]): Promise<boolean[]> => {
	const flags: boolean[] = [];

	for (let i = 0; i < texts.length; i += CHUNK) {
		const res = await fetch(MODERATION_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({ model: "omni-moderation-latest", input: texts.slice(i, i + CHUNK) })
		});

		if (!res.ok) throw new Error(`OpenAI moderation returned HTTP ${res.status}`);

		const parsed = responseSchema.parse(await res.json());

		for (const result of parsed.results) flags.push(result.flagged);
	}

	return flags;
};
