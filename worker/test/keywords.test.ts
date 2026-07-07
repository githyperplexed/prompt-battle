import { describe, expect, test } from "bun:test";

import {
	hasAllKeywords,
	keywordHash,
	matchesKeywordHash,
	parseKeywordList
} from "../src/utilities/keywords";

describe("keyword list parsing", () => {
	test("splits, trims, and keeps the original forms", () => {
		expect(parseKeywordList(" Marble, lantern ,quartz ")).toEqual(["Marble", "lantern", "quartz"]);
	});

	test("rejects anything but exactly three keywords", () => {
		expect(() => parseKeywordList("one,two")).toThrow("exactly three");
		expect(() => parseKeywordList("one,two,three,four")).toThrow("exactly three");
		expect(() => parseKeywordList("one,,three")).toThrow("exactly three");
	});

	test("rejects case-insensitive duplicates", () => {
		expect(() => parseKeywordList("word,WORD,other")).toThrow("distinct");
	});

	test("rejects the normalization separator", () => {
		expect(() => parseKeywordList("a|b,two,three")).toThrow('"|"');
	});
});

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

describe("keyword matching", () => {
	test("matches all keywords case-insensitively in any order", () => {
		expect(hasAllKeywords("Beta comes before ALPHA here", ["alpha", "beta"])).toBe(true);
	});

	test("requires every keyword", () => {
		expect(hasAllKeywords("only alpha appears", ["alpha", "beta"])).toBe(false);
	});

	test("matches whole words only", () => {
		expect(hasAllKeywords("alphabet soup", ["alpha"])).toBe(false);
		expect(hasAllKeywords("infra-alpha build", ["alpha"])).toBe(true);
	});

	test("matches non-ASCII keywords", () => {
		expect(hasAllKeywords("un vrai déjà vu", ["déjà"])).toBe(true);
		expect(hasAllKeywords("übermensch again", ["übermensch"])).toBe(true);
		expect(hasAllKeywords("déjàvu is one word", ["déjà"])).toBe(false);
	});

	test("matches keywords wrapped in YouTube formatting characters", () => {
		expect(hasAllKeywords("that was _alpha_ energy", ["alpha"])).toBe(true);
		expect(hasAllKeywords("that was *alpha* energy", ["alpha"])).toBe(true);
	});
});
