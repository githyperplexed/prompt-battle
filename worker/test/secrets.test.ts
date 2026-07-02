import { afterEach, describe, expect, test } from "bun:test";

import { loadKeywordSecret } from "../src/services/secrets";

const originalEnv = process.env.KEYWORD_SECRETS;

afterEach(() => {
	if (originalEnv === undefined) {
		delete process.env.KEYWORD_SECRETS;
	} else {
		process.env.KEYWORD_SECRETS = originalEnv;
	}
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
