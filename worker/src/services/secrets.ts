import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type KeywordSecret = { keywords: string[]; salt: string };

const secretsPath = (videoId: string): string =>
	fileURLToPath(new URL(`../../../secrets/${videoId}.json`, import.meta.url));

export const mintSalt = (): string => randomBytes(16).toString("hex");

export const writeKeywordSecret = (
	videoId: string,
	secret: KeywordSecret,
	force = false
): string => {
	// The id becomes a filename; anything outside the plain YouTube-id alphabet could escape
	// the secrets directory.
	if (!/^[\w-]+$/.test(videoId)) {
		throw new Error("--video must contain only letters, digits, hyphens, and underscores");
	}

	const path = secretsPath(videoId);

	if (!force && existsSync(path)) {
		throw new Error(
			`secrets/${videoId}.json already exists — pass --force to overwrite (this discards its salt)`
		);
	}

	writeFileSync(path, JSON.stringify(validate(secret, "secret"), null, "\t") + "\n");

	return path;
};

const validate = (secret: KeywordSecret, source: string): KeywordSecret => {
	const valid =
		Array.isArray(secret?.keywords) &&
		secret.keywords.length === 3 &&
		typeof secret.salt === "string" &&
		secret.salt.length > 0;

	if (!valid) {
		throw new Error(`${source} must contain { keywords: [3 strings], salt: string }`);
	}

	return secret;
};

const loadFromEnv = (videoId: string): KeywordSecret | undefined => {
	const raw = process.env.KEYWORD_SECRETS;

	if (!raw) return undefined;

	let parsed: Record<string, KeywordSecret>;

	try {
		parsed = JSON.parse(raw) as Record<string, KeywordSecret>;
	} catch {
		throw new Error(
			"KEYWORD_SECRETS is not valid JSON — expected a { <videoId>: { keywords, salt } } map"
		);
	}

	const secret = parsed[videoId];

	if (!secret) return undefined;

	return validate(secret, `KEYWORD_SECRETS entry for ${videoId}`);
};

export const loadKeywordSecret = (videoId: string): KeywordSecret => {
	const path = secretsPath(videoId);

	if (existsSync(path)) {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as KeywordSecret;

		return validate(parsed, `secrets/${videoId}.json`);
	}

	const fromEnv = loadFromEnv(videoId);

	if (fromEnv) return fromEnv;

	throw new Error(
		`No keyword secret for ${videoId} — provide secrets/${videoId}.json or a KEYWORD_SECRETS entry`
	);
};
