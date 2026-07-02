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

// JS `\b` is ASCII-only — a keyword starting or ending in a non-ASCII letter (café, déjà)
// could never match. "Whole word" here means not directly adjacent to another letter or
// digit, the same delimiter definition the similarity pass uses for keyword stripping.
export const hasAllKeywords = (text: string, keywords: string[]): boolean =>
	keywords.every((keyword) =>
		new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(keyword.trim())}(?![\\p{L}\\p{N}])`, "iu").test(
			text
		)
	);

export const matchesKeywordHash = (
	keywords: string[],
	salt: string,
	expectedHash: string
): boolean => keywordHash(keywords, salt) === expectedHash;
