import type { RenderState } from "./phases";

export const CONTEST_TITLE = "The Prompt Battle";

export const CONTEST_SUBTITLE =
	"Players get one comment to convince a panel of three independent AI judges to pick them over everyone else, using any prompting tactic they can. The top 64 advance to a single-elimination bracket that crowns one winner.";

// Kept under ~160 characters for search / social previews, unlike the on-page subtitle.
export const META_DESCRIPTION =
	"One YouTube comment to convince three AI judges you should win. The top 64 entries fight through a single-elimination bracket until one champion remains.";

const STATE_TITLES: Partial<Record<RenderState, string>> = {
	open: "Entries open",
	snapshotted: "The frozen field",
	scoring: "Judging in progress",
	scored: "The leaderboard",
	locked: "Results locked",
	complete: "The champion"
};

export const pageTitle = (state?: RenderState): string => {
	const suffix = state ? STATE_TITLES[state] : undefined;

	return suffix ? `${CONTEST_TITLE} — ${suffix}` : CONTEST_TITLE;
};
