import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type KeywordSecret = { keywords: string[]; salt: string };

export const loadKeywordSecret = (videoId: string): KeywordSecret => {
	const path = fileURLToPath(new URL(`../../../secrets/${videoId}.json`, import.meta.url));
	const parsed = JSON.parse(readFileSync(path, "utf8")) as KeywordSecret;

	const valid =
		Array.isArray(parsed.keywords) &&
		parsed.keywords.length === 3 &&
		typeof parsed.salt === "string" &&
		parsed.salt.length > 0;

	if (!valid) {
		throw new Error(`secrets/${videoId}.json must contain { keywords: [3 strings], salt: string }`);
	}

	return parsed;
};
