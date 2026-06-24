export const parseChannelList = (raw: string | undefined): string[] =>
	(raw ?? "")
		.split(",")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

export const isChannelId = (token: string): boolean => token.startsWith("UC");
