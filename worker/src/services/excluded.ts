import { isChannelId, parseChannelList } from "$src/utilities/channels";
import { resolveChannelId } from "$src/services/youtube";

// Resolves a mixed list of `@handle` / `UC…` tokens to a set of channel ids. Raw ids pass through;
// handles are looked up via the YouTube API (an unresolvable handle is warned and skipped).
export const resolveChannelTokens = async (tokens: string[]): Promise<Set<string>> => {
	const ids = new Set<string>();

	for (const token of tokens) {
		if (isChannelId(token)) {
			ids.add(token);
			continue;
		}

		const resolved = await resolveChannelId(token);

		if (resolved) ids.add(resolved);
		else console.warn(`Could not resolve channel "${token}"`);
	}

	return ids;
};

export const resolveExcludedChannels = (): Promise<Set<string>> =>
	resolveChannelTokens(parseChannelList(process.env.EXCLUDED_CHANNELS));
