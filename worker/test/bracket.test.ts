import { describe, expect, test } from "bun:test";

import {
	bracketFingerprint,
	nextPowerOfTwo,
	seedOrder,
	tallyMatchup
} from "../src/utilities/bracket";

describe("bracket fingerprint", () => {
	test("is stable for the same seeded field", () => {
		const seeded = [
			{ id: "entry-a", rank: 1, seed: 1, absoluteScore: 91.2 },
			{ id: "entry-b", rank: 2, seed: 2, absoluteScore: 88.4 }
		];

		expect(bracketFingerprint(seeded)).toBe(bracketFingerprint([...seeded]));
	});

	test("changes when seed order changes", () => {
		const original = bracketFingerprint([
			{ id: "entry-a", rank: 1, seed: 1, absoluteScore: 91.2 },
			{ id: "entry-b", rank: 2, seed: 2, absoluteScore: 88.4 }
		]);
		const changed = bracketFingerprint([
			{ id: "entry-b", rank: 1, seed: 1, absoluteScore: 88.4 },
			{ id: "entry-a", rank: 2, seed: 2, absoluteScore: 91.2 }
		]);

		expect(changed).not.toBe(original);
	});

	test("changes when a scored-field value changes", () => {
		const original = bracketFingerprint([{ id: "entry-a", rank: 1, seed: 1, absoluteScore: 91.2 }]);
		const changed = bracketFingerprint([{ id: "entry-a", rank: 1, seed: 1, absoluteScore: 91.3 }]);

		expect(changed).not.toBe(original);
	});
});

describe("bracket utilities", () => {
	test("computes powers of two for bracket sizing", () => {
		expect(nextPowerOfTwo(0)).toBe(1);
		expect(nextPowerOfTwo(1)).toBe(1);
		expect(nextPowerOfTwo(3)).toBe(4);
		expect(nextPowerOfTwo(64)).toBe(64);
	});

	test("orders seeds so top seeds meet as late as possible", () => {
		expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
	});

	test("tallies only consistent model votes and deadlocks to higher seed", () => {
		expect(
			tallyMatchup("a", "b", [
				{ modelId: "m1", chosenEntryId: "b" },
				{ modelId: "m1", chosenEntryId: "b" },
				{ modelId: "m2", chosenEntryId: "a" },
				{ modelId: "m2", chosenEntryId: "b" }
			])
		).toBe("b");
		expect(tallyMatchup("a", "b", [])).toBe("a");
	});
});
