import { describe, expect, test } from "bun:test";

import { parsePositiveInt } from "../src/utilities/args";

describe("parsePositiveInt", () => {
	test("returns undefined when the flag is absent", () => {
		expect(parsePositiveInt(undefined, "--max-entries")).toBeUndefined();
	});

	test("parses a positive integer", () => {
		expect(parsePositiveInt("100", "--max-entries")).toBe(100);
	});

	test("rejects zero, negatives, fractions, and non-numbers", () => {
		expect(() => parsePositiveInt("0", "--max-entries")).toThrow();
		expect(() => parsePositiveInt("-5", "--max-entries")).toThrow();
		expect(() => parsePositiveInt("12.5", "--max-entries")).toThrow();
		expect(() => parsePositiveInt("abc", "--max-entries")).toThrow();
	});
});
