import { describe, expect, test } from "bun:test";

import { packBatches } from "$src/utilities/batching";

describe("packBatches", () => {
	test("packs everything into one batch when under both caps", () => {
		expect(packBatches(["a", "b", "c"], 100, 50)).toEqual([["a", "b", "c"]]);
	});

	test("splits when the char budget would overflow", () => {
		expect(packBatches(["aaaa", "bbbb", "cc"], 8, 50)).toEqual([["aaaa", "bbbb"], ["cc"]]);
	});

	test("splits when the count cap is reached", () => {
		expect(packBatches(["a", "b", "c", "d", "e"], 100, 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
	});

	test("an item exceeding the char budget alone still gets a batch", () => {
		expect(packBatches(["aa", "xxxxxxxxxx", "bb"], 5, 50)).toEqual([
			["aa"],
			["xxxxxxxxxx"],
			["bb"]
		]);
	});

	test("preserves input order across batches", () => {
		const texts = Array.from({ length: 10 }, (_, i) => `t${i}`);

		expect(packBatches(texts, 4, 50).flat()).toEqual(texts);
	});

	test("returns no batches for no texts", () => {
		expect(packBatches([], 10, 10)).toEqual([]);
	});
});
