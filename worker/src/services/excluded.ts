import { isChannelId, parseChannelList } from "$src/utilities/channels";
import { resolveChannelId } from "$src/services/youtube";

// Resolves a mixed list of `@handle` / `UC…` tokens to channel ids, keyed by the token the
// operator supplied (so reporting can speak in their terms). Raw ids pass through; handles are
// looked up via the YouTube API. An unresolvable handle throws: silently skipping one could
// freeze a snapshot with an affiliated account still eligible (rules §3).
export const resolveChannelTokens = async (tokens: string[]): Promise<Map<string, string>> => {
	const idByToken = new Map<string, string>();

	for (const token of tokens) {
		if (isChannelId(token)) {
			idByToken.set(token, token);
			continue;
		}

		const resolved = await resolveChannelId(token);

		if (!resolved) {
			throw new Error(`Could not resolve channel "${token}" — fix the handle or use its UC… id`);
		}

		idByToken.set(token, resolved);
	}

	return idByToken;
};

export const resolveExcludedChannels = async (): Promise<Set<string>> =>
	new Set((await resolveChannelTokens(parseChannelList(process.env.EXCLUDED_CHANNELS))).values());
