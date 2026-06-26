import { describe, expect, test } from "bun:test";

import { advisoryLockKeys } from "../src/utilities/locks";

describe("advisoryLockKeys", () => {
	test("is deterministic for the same contest id", () => {
		expect(advisoryLockKeys("contest-abc")).toEqual(advisoryLockKeys("contest-abc"));
	});

	test("differs for different contest ids", () => {
		expect(advisoryLockKeys("contest-abc")).not.toEqual(advisoryLockKeys("contest-xyz"));
	});

	test("produces a pair of 32-bit signed integers", () => {
		const [a, b] = advisoryLockKeys("contest-abc");

		for (const key of [a, b]) {
			expect(Number.isInteger(key)).toBe(true);
			expect(key).toBeGreaterThanOrEqual(-(2 ** 31));
			expect(key).toBeLessThanOrEqual(2 ** 31 - 1);
		}
	});
});
