import { createHash } from "node:crypto";

import { escapeRegExp } from "$src/utilities/text";

export const normalizeKeywords = (keywords: string[]): string =>
	keywords
		.map((k) => k.trim().toLowerCase())
		.sort()
		.join("|");

// Committed before the snapshot; the salt is revealed with the results so anyone can
// recompute this hash from the published keywords and confirm they were not changed.
export const keywordHash = (keywords: string[], salt: string): string =>
	createHash("sha256")
		.update(`${salt}:${normalizeKeywords(keywords)}`)
		.digest("hex");

export const hasAllKeywords = (text: string, keywords: string[]): boolean =>
	keywords.every((keyword) => new RegExp(`\\b${escapeRegExp(keyword.trim())}\\b`, "i").test(text));

export const matchesKeywordHash = (
	keywords: string[],
	salt: string,
	expectedHash: string
): boolean => keywordHash(keywords, salt) === expectedHash;
