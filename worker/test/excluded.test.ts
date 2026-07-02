import { afterEach, beforeAll, describe, expect, test } from "bun:test";

process.env.YOUTUBE_API_KEY = "test-youtube-key";

let resolveChannelTokens: typeof import("../src/services/excluded").resolveChannelTokens;
const originalFetch = globalThis.fetch;

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeAll(async () => {
	({ resolveChannelTokens } = await import("../src/services/excluded"));
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("excluded channel resolution", () => {
	test("passes raw UC… ids through without hitting the API", async () => {
		globalThis.fetch = (async () => {
			throw new Error("unexpected fetch");
		}) as unknown as typeof fetch;

		const ids = await resolveChannelTokens(["UCraw1234567890abcdefgh"]);

		expect([...ids]).toEqual([["UCraw1234567890abcdefgh", "UCraw1234567890abcdefgh"]]);
	});

	test("resolves handles via the API, keyed by the supplied token", async () => {
		globalThis.fetch = (async () =>
			response({ items: [{ id: "UCresolved" }] })) as unknown as typeof fetch;

		const ids = await resolveChannelTokens(["@someone"]);

		expect([...ids]).toEqual([["@someone", "UCresolved"]]);
	});

	test("throws when a handle cannot be resolved instead of skipping it", async () => {
		globalThis.fetch = (async () => response({ items: [] })) as unknown as typeof fetch;

		await expect(resolveChannelTokens(["@missing"])).rejects.toThrow(
			'Could not resolve channel "@missing"'
		);
	});
});
