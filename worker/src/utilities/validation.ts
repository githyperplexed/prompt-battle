import { MAX_CHARS, MIN_CHARS } from "../constants";
import { hasAllKeywords } from "./keywords";

const URL_REGEX =
	/(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|gg|tv|co|me|ly|app|dev|xyz|link|info|biz)\b/i;

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
