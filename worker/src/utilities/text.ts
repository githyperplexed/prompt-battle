import { randomBytes } from "node:crypto";

export const makeNonce = (): string => `BOUNDARY_${randomBytes(16).toString("hex")}`;

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Replace every token in a SINGLE pass so inserted content is never re-scanned — a literal
// token sitting inside one replacement value can never be turned into a real delimiter.
export const replaceTokens = (template: string, replacements: Record<string, string>): string => {
	const re = new RegExp(Object.keys(replacements).map(escapeRegExp).join("|"), "g");

	return template.replace(re, (token) => replacements[token] ?? token);
};
