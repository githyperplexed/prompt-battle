export const DQ_REASON_LABELS: Record<string, string> = {
	missing_keywords: "Missing keywords",
	too_short: "Too short",
	too_long: "Too long",
	has_url: "Contains a URL",
	duplicate_channel: "Duplicate channel",
	affiliated: "Affiliated account",
	tos: "Removed for content policy",
	edited_after_cutoff: "Edited after cutoff",
	deleted: "Deleted"
};

export const dqLabel = (reason: string): string => DQ_REASON_LABELS[reason] ?? reason;
