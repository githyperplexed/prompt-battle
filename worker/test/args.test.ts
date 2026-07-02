import { describe, expect, test } from "bun:test";

import { parseIsoTimestamp, parsePositiveInt } from "../src/utilities/args";

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

describe("parseIsoTimestamp", () => {
	test("parses UTC and offset timestamps", () => {
		expect(parseIsoTimestamp("2026-07-04T18:00:00Z", "--at").toISOString()).toBe(
			"2026-07-04T18:00:00.000Z"
		);
		expect(parseIsoTimestamp("2026-07-04T18:00:00.500Z", "--at").getMilliseconds()).toBe(500);
		expect(parseIsoTimestamp("2026-07-04T18:00:00-05:00", "--at").toISOString()).toBe(
			"2026-07-04T23:00:00.000Z"
		);
		expect(parseIsoTimestamp("2026-07-04T18:00Z", "--at").toISOString()).toBe(
			"2026-07-04T18:00:00.000Z"
		);
	});

	test("rejects timestamps without an explicit offset", () => {
		// `new Date` would silently parse these as local machine time.
		expect(() => parseIsoTimestamp("2026-07-04T18:00:00", "--at")).toThrow("explicit offset");
		expect(() => parseIsoTimestamp("2026-07-04", "--at")).toThrow("explicit offset");
	});

	test("rejects non-ISO date strings", () => {
		expect(() => parseIsoTimestamp("July 4 2026", "--at")).toThrow("explicit offset");
		expect(() => parseIsoTimestamp("2026", "--at")).toThrow("explicit offset");
	});
});
