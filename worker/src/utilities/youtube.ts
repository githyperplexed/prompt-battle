import { z } from "zod";

const COMMENT_THREADS_URL = "https://www.googleapis.com/youtube/v3/commentThreads";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

export const commentItemSchema = z.object({
	snippet: z.object({
		topLevelComment: z.object({
			id: z.string(),
			snippet: z.object({
				authorDisplayName: z.string(),
				authorChannelId: z.object({ value: z.string() }),
				textOriginal: z.string(),
				publishedAt: z.string(),
				updatedAt: z.string()
			})
		})
	})
});

export type CommentItem = z.infer<typeof commentItemSchema>;

export const commentsResponseSchema = z.object({
	items: z.array(z.unknown()).optional().default([]),
	nextPageToken: z.string().optional(),
	error: z
		.object({
			message: z.string(),
			errors: z.array(z.object({ reason: z.string() })).optional()
		})
		.optional()
});

export const channelsResponseSchema = z.object({
	items: z
		.array(z.object({ id: z.string() }))
		.optional()
		.default([])
});

export type YouTubeComment = {
	commentId: string;
	channelId: string;
	authorDisplayName: string;
	text: string;
	publishedAt: Date;
	updatedAt: Date;
};

export const buildCommentsUrl = (videoId: string, apiKey: string, pageToken?: string): string => {
	const url = new URL(COMMENT_THREADS_URL);

	url.searchParams.set("part", "snippet");
	url.searchParams.set("videoId", videoId);
	url.searchParams.set("maxResults", "100");
	url.searchParams.set("order", "time");
	url.searchParams.set("key", apiKey);

	if (pageToken) url.searchParams.set("pageToken", pageToken);

	return url.toString();
};

export const buildChannelUrl = (handle: string, apiKey: string): string => {
	const url = new URL(CHANNELS_URL);

	url.searchParams.set("part", "id");
	url.searchParams.set("forHandle", handle.startsWith("@") ? handle : `@${handle}`);
	url.searchParams.set("key", apiKey);

	return url.toString();
};

export const toComment = (item: CommentItem): YouTubeComment => {
	const { id, snippet } = item.snippet.topLevelComment;

	return {
		commentId: id,
		channelId: snippet.authorChannelId.value,
		authorDisplayName: snippet.authorDisplayName,
		text: snippet.textOriginal,
		publishedAt: new Date(snippet.publishedAt),
		updatedAt: new Date(snippet.updatedAt)
	};
};
