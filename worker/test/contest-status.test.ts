import { describe, expect, test } from "bun:test";

import { canResetTo, isResetTarget } from "../src/utilities/contest-status";

describe("contest status reset rules", () => {
	test("recognizes valid reset targets", () => {
		expect(isResetTarget("open")).toBe(true);
		expect(isResetTarget("snapshotted")).toBe(true);
		expect(isResetTarget("scored")).toBe(true);
		expect(isResetTarget("scoring")).toBe(false);
		expect(isResetTarget("complete")).toBe(false);
	});

	test("allows resets only from a status past the target", () => {
		expect(canResetTo("snapshotted", "open")).toBe(true);
		expect(canResetTo("complete", "open")).toBe(true);
		expect(canResetTo("open", "open")).toBe(false);

		expect(canResetTo("scored", "snapshotted")).toBe(true);
		expect(canResetTo("snapshotted", "snapshotted")).toBe(false);

		expect(canResetTo("complete", "scored")).toBe(true);
		expect(canResetTo("scored", "scored")).toBe(true);
		expect(canResetTo("scoring", "scored")).toBe(false);
	});
});
