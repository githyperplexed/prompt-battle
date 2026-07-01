export const parseCsv = (raw: string | undefined): string[] =>
	(raw ?? "")
		.split(",")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

// A channel list is just a CSV of tokens (`@handle` or `UC…` ids).
export const parseChannelList = parseCsv;

export const isChannelId = (token: string): boolean => token.startsWith("UC");
