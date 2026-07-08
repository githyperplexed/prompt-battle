import { describe, expect, test } from "bun:test";

import { isNoOutputError, withRefusalConfirmation } from "../src/utilities/judge";

const noOutputError = (message = "No output generated.") =>
	Object.assign(new Error(message), { name: "AI_NoOutputGeneratedError" });

describe("isNoOutputError", () => {
	test("recognizes the AI SDK no-output error by name", () => {
		expect(isNoOutputError(noOutputError())).toBe(true);
	});

	test("does not treat transient errors as refusals", () => {
		expect(isNoOutputError(new Error("fetch failed"))).toBe(false);
		expect(isNoOutputError(Object.assign(new Error("429"), { name: "APICallError" }))).toBe(false);
		expect(isNoOutputError(null)).toBe(false);
		expect(isNoOutputError(undefined)).toBe(false);
	});
});

describe("withRefusalConfirmation", () => {
	test("returns the value on first success without retrying", async () => {
		let calls = 0;

		const outcome = await withRefusalConfirmation(
			async () => {
				calls += 1;
				return "scored";
			},
			{ attempts: 3, delayMs: 0 }
		);

		expect(outcome).toEqual({ refused: false, value: "scored" });
		expect(calls).toBe(1);
	});

	test("retries a no-output error and succeeds on a later attempt", async () => {
		let calls = 0;

		const outcome = await withRefusalConfirmation(
			async () => {
				calls += 1;

				if (calls === 1) throw noOutputError();

				return "scored";
			},
			{ attempts: 3, delayMs: 0 }
		);

		expect(outcome).toEqual({ refused: false, value: "scored" });
		expect(calls).toBe(2);
	});

	test("confirms a refusal after exhausting every attempt", async () => {
		let calls = 0;

		const outcome = await withRefusalConfirmation(
			async () => {
				calls += 1;
				throw noOutputError("refused by safety filter");
			},
			{ attempts: 3, delayMs: 0 }
		);

		expect(outcome).toEqual({ refused: true, detail: "refused by safety filter" });
		expect(calls).toBe(3);
	});

	test("rethrows transient errors on the first attempt", async () => {
		let calls = 0;

		const call = async () => {
			calls += 1;
			throw new Error("fetch failed");
		};

		await expect(withRefusalConfirmation(call, { attempts: 3, delayMs: 0 })).rejects.toThrow(
			"fetch failed"
		);
		expect(calls).toBe(1);
	});
});
