import { isChannelId, parseChannelList } from "../utilities/channels";
import { resolveChannelId } from "./youtube";

export const resolveExcludedChannels = async (): Promise<Set<string>> => {
	const tokens = parseChannelList(process.env.EXCLUDED_CHANNELS);
	const ids = new Set<string>();

	for (const token of tokens) {
		if (isChannelId(token)) {
			ids.add(token);
			continue;
		}

		const resolved = await resolveChannelId(token);

		if (resolved) ids.add(resolved);
		else console.warn(`Could not resolve excluded channel "${token}"`);
	}

	return ids;
};
