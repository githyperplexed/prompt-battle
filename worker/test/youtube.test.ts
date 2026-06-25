import { afterEach, beforeAll, describe, expect, test } from "bun:test";

process.env.YOUTUBE_API_KEY = "test-youtube-key";

let fetchAllComments: typeof import("../src/services/youtube").fetchAllComments;
const originalFetch = globalThis.fetch;

const item = (id: string) => ({
	snippet: {
		topLevelComment: {
			id,
			snippet: {
				authorDisplayName: `Author ${id}`,
				authorChannelId: { value: `channel-${id}` },
				textOriginal: `text ${id}`,
				publishedAt: "2026-06-24T12:00:00.000Z",
				updatedAt: "2026-06-24T12:00:00.000Z"
			}
		}
	}
});

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeAll(async () => {
	({ fetchAllComments } = await import("../src/services/youtube"));
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("YouTube comment history fetch", () => {
	test("reports incomplete history when another page exists at the fetch cap", async () => {
		globalThis.fetch = (async () =>
			response({
				items: [item("1"), item("2")],
				nextPageToken: "next-page"
			})) as unknown as typeof fetch;

		const result = await fetchAllComments("video-1", { maxComments: 2 });

		expect(result.comments.map((comment) => comment.commentId)).toEqual(["1", "2"]);
		expect(result.complete).toBe(false);
		expect(result.maxComments).toBe(2);
	});

	test("reports complete history when pagination is exhausted", async () => {
		globalThis.fetch = (async () => response({ items: [item("1")] })) as unknown as typeof fetch;

		const result = await fetchAllComments("video-1", { maxComments: 2 });

		expect(result.comments.map((comment) => comment.commentId)).toEqual(["1"]);
		expect(result.complete).toBe(true);
	});
});
