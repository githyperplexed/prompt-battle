import { MAX_CHARS, MIN_CHARS } from "$src/constants";
import { hasAllKeywords } from "$src/utilities/keywords";

// Heuristic, not a full URL parser: protocol/www links, youtu.be share links (the likeliest
// link in a YouTube comment — `be` stays off the bare-TLD list because "to.be"-style typos
// would false-positive), and bare domains on common TLDs. The trailing lookahead (instead of
// `\b`) keeps hyphenated prose like "epic.Co-sign" from matching.
const URL_REGEX =
	/(https?:\/\/|www\.)\S+|\byoutu\.be\/\S+|\b[a-z0-9-]+\.(?:com|net|org|io|gg|tv|co|me|ly|ai|app|dev|xyz|link|info|biz)(?![\w-])/i;

export const countCharacters = (text: string): number => [...text].length;

export const containsUrl = (text: string): boolean => URL_REGEX.test(text);

export type DqReason = "affiliated" | "too_short" | "too_long" | "has_url" | "missing_keywords";

export type Classification = { eligible: true } | { eligible: false; reason: DqReason };

export const classifyComment = (
	comment: { text: string; channelId: string },
	context: { keywords: string[]; excluded: Set<string> }
): Classification => {
	if (context.excluded.has(comment.channelId)) return { eligible: false, reason: "affiliated" };

	const length = countCharacters(comment.text);

	if (length < MIN_CHARS) return { eligible: false, reason: "too_short" };
	if (length > MAX_CHARS) return { eligible: false, reason: "too_long" };
	if (containsUrl(comment.text)) return { eligible: false, reason: "has_url" };

	if (!hasAllKeywords(comment.text, context.keywords)) {
		return { eligible: false, reason: "missing_keywords" };
	}

	return { eligible: true };
};
