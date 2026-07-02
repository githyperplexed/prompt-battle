import {
	buildChannelUrl,
	buildCommentsUrl,
	channelsResponseSchema,
	commentItemSchema,
	commentsResponseSchema,
	toComment,
	type YouTubeComment
} from "$src/utilities/youtube";

// Safety bound on a runaway fetch; the per-contest entry cap is applied later in validation.
const MAX_COMMENTS = 100_000;

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

type CommentPage = {
	comments: YouTubeComment[];
	nextPageToken?: string;
	skipped: number;
};

export type CommentHistory = {
	comments: YouTubeComment[];
	complete: boolean;
	maxComments: number;
	skipped: number;
};

const fetchCommentPage = async (
	videoId: string,
	pageToken: string | undefined
): Promise<CommentPage> => {
	const res = await fetch(buildCommentsUrl(videoId, apiKey, pageToken));
	const parsed = commentsResponseSchema.parse(await res.json());

	if (parsed.error) {
		const reason = parsed.error.errors?.[0]?.reason;

		// Comments turned off is a legitimate "no entries" outcome, not a failure.
		if (reason === "commentsDisabled") return { comments: [], skipped: 0 };

		throw new Error(`YouTube API error (${reason ?? res.status}): ${parsed.error.message}`);
	}

	if (!res.ok) throw new Error(`YouTube API returned HTTP ${res.status}`);

	const comments: YouTubeComment[] = [];
	let skipped = 0;

	// Parse each item on its own so one malformed comment can't drop a whole page.
	for (const item of parsed.items) {
		const result = commentItemSchema.safeParse(item);

		if (!result.success) {
			skipped += 1;
			continue;
		}

		comments.push(toComment(result.data));
	}

	return { comments, nextPageToken: parsed.nextPageToken, skipped };
};

export const fetchAllComments = async (
	videoId: string,
	options: { maxComments?: number } = {}
): Promise<CommentHistory> => {
	const maxComments = options.maxComments ?? MAX_COMMENTS;
	const comments: YouTubeComment[] = [];

	let pageToken: string | undefined;
	let skipped = 0;
	let complete = true;

	do {
		const page = await fetchCommentPage(videoId, pageToken);
		const remaining = maxComments - comments.length;

		comments.push(...page.comments.slice(0, remaining));
		skipped += page.skipped;
		pageToken = page.nextPageToken;

		// The history is truncated whenever comments exist beyond the cap — a page cut mid-way
		// or another page still pending. Either way the snapshot must abort, not freeze partial.
		if (page.comments.length > remaining || (pageToken && comments.length >= maxComments)) {
			complete = false;
		}
	} while (complete && pageToken);

	if (skipped > 0) console.warn(`Skipped ${skipped} unparseable comment(s) for video ${videoId}`);

	return { comments, complete, maxComments, skipped };
};

// Returns null only when the handle genuinely does not exist; an API failure (quota, auth)
// throws so callers can never mistake an outage for "no such channel".
export const resolveChannelId = async (handle: string): Promise<string | null> => {
	const res = await fetch(buildChannelUrl(handle, apiKey));
	const parsed = channelsResponseSchema.parse(await res.json());

	if (parsed.error) {
		const reason = parsed.error.errors?.[0]?.reason;

		throw new Error(
			`YouTube API error (${reason ?? res.status}) resolving channel "${handle}": ${parsed.error.message}`
		);
	}

	if (!res.ok) {
		throw new Error(`YouTube API returned HTTP ${res.status} resolving channel "${handle}"`);
	}

	return parsed.items[0]?.id ?? null;
};
