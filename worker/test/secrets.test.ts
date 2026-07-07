import { existsSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, test } from "bun:test";

import { loadKeywordSecret, mintSalt, writeKeywordSecret } from "../src/services/secrets";

const originalEnv = process.env.KEYWORD_SECRETS;
const TEST_VIDEO_ID = "test-write-round-trip";

afterEach(() => {
	if (originalEnv === undefined) {
		delete process.env.KEYWORD_SECRETS;
	} else {
		process.env.KEYWORD_SECRETS = originalEnv;
	}

	const written = new URL(`../../secrets/${TEST_VIDEO_ID}.json`, import.meta.url);

	if (existsSync(written)) unlinkSync(written);
});

describe("keyword secret writing", () => {
	const secret = { keywords: ["one", "two", "three"], salt: "some-salt" };

	test("writes a file that loads back identically", () => {
		writeKeywordSecret(TEST_VIDEO_ID, secret);

		expect(loadKeywordSecret(TEST_VIDEO_ID)).toEqual(secret);
	});

	test("refuses to overwrite an existing secret without force", () => {
		writeKeywordSecret(TEST_VIDEO_ID, secret);

		expect(() => writeKeywordSecret(TEST_VIDEO_ID, secret)).toThrow("already exists");
		expect(() => writeKeywordSecret(TEST_VIDEO_ID, secret, true)).not.toThrow();
	});

	test("rejects a video id that could escape the secrets directory", () => {
		expect(() => writeKeywordSecret("../evil", secret)).toThrow("letters, digits");
	});

	test("rejects a malformed secret", () => {
		expect(() => writeKeywordSecret(TEST_VIDEO_ID, { keywords: ["only-one"], salt: "s" })).toThrow(
			"must contain"
		);
	});

	test("mints hex salts", () => {
		expect(mintSalt()).toMatch(/^[0-9a-f]{32}$/);
		expect(mintSalt()).not.toBe(mintSalt());
	});
});

describe("keyword secret loading", () => {
	test("prefers the secrets file over a KEYWORD_SECRETS entry", () => {
		process.env.KEYWORD_SECRETS = JSON.stringify({
			example: { keywords: ["ENV-ONE", "ENV-TWO", "ENV-THREE"], salt: "env-salt" }
		});

		const secret = loadKeywordSecret("example");

		expect(secret.keywords).toEqual(["EXAMPLE-ONE", "EXAMPLE-TWO", "EXAMPLE-THREE"]);
	});

	test("falls back to KEYWORD_SECRETS when the file is missing", () => {
		process.env.KEYWORD_SECRETS = JSON.stringify({
			"missing-video": { keywords: ["ONE", "TWO", "THREE"], salt: "some-salt" }
		});

		const secret = loadKeywordSecret("missing-video");

		expect(secret).toEqual({ keywords: ["ONE", "TWO", "THREE"], salt: "some-salt" });
	});

	test("throws when neither the file nor an env entry exists", () => {
		delete process.env.KEYWORD_SECRETS;

		expect(() => loadKeywordSecret("missing-video")).toThrow("No keyword secret for missing-video");
	});

	test("throws when KEYWORD_SECRETS is set but has no entry for the video", () => {
		process.env.KEYWORD_SECRETS = JSON.stringify({
			"other-video": { keywords: ["ONE", "TWO", "THREE"], salt: "some-salt" }
		});

		expect(() => loadKeywordSecret("missing-video")).toThrow("No keyword secret for missing-video");
	});

	test("throws when KEYWORD_SECRETS is not valid JSON", () => {
		process.env.KEYWORD_SECRETS = "not json";

		expect(() => loadKeywordSecret("missing-video")).toThrow("KEYWORD_SECRETS is not valid JSON");
	});

	test("throws when an env entry has the wrong shape", () => {
		process.env.KEYWORD_SECRETS = JSON.stringify({
			"missing-video": { keywords: ["ONLY-ONE"], salt: "some-salt" }
		});

		expect(() => loadKeywordSecret("missing-video")).toThrow(
			"must contain { keywords: [3 strings], salt: string }"
		);
	});
});
