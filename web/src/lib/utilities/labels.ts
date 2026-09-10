export const DQ_REASON_LABELS: Record<string, string> = {
	missing_keywords: "Missing keywords",
	too_short: "Too short",
	too_long: "Too long",
	has_url: "Contains a URL",
	duplicate_channel: "Duplicate channel",
	affiliated: "Affiliated account",
	tos: "Removed for content policy",
	edited_after_cutoff: "Edited after cutoff",
	over_cap: "Over the entry cap",
	deleted: "Deleted",
	unscorable: "Unscorable (a panel model refused)"
};

export const dqLabel = (reason: string): string => DQ_REASON_LABELS[reason] ?? reason;

// How far an entry got, as a label for a leaderboard row.
export const bracketResultLabel = (
	round: number,
	totalRounds: number,
	champion: boolean
): string => {
	if (champion) return "Champion";
	if (round === totalRounds) return "Finalist";
	if (round === totalRounds - 1) return "Semifinal";
	if (round === totalRounds - 2) return "Quarterfinal";

	return `Round of ${2 ** (totalRounds - round + 1)}`;
};
