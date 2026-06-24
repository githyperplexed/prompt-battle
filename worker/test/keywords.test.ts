import { describe, expect, test } from "bun:test";

import { keywordHash, matchesKeywordHash } from "../src/utilities/keywords";

describe("keyword commitment", () => {
	const keywords = ["first", "second", "third"];
	const salt = "contest-salt";
	const committed = keywordHash(keywords, salt);

	test("accepts the keyword secret used to create the commitment", () => {
		expect(matchesKeywordHash(keywords, salt, committed)).toBe(true);
	});

	test("rejects changed keywords or salt", () => {
		expect(matchesKeywordHash(["changed", "second", "third"], salt, committed)).toBe(false);
		expect(matchesKeywordHash(keywords, "changed-salt", committed)).toBe(false);
	});
});
