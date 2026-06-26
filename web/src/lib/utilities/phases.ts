// The five lifecycle phases that share a contest.status value.
export const PHASES = ["open", "snapshotted", "scoring", "scored", "complete"] as const;

export type Phase = (typeof PHASES)[number];

// Everything the page can render, including UI-only states with no contest.status equivalent
// (`locked` = results embargoed, `draft`/`not_found` = pre-open / missing).
export const RENDER_STATES = [...PHASES, "locked", "draft", "not_found"] as const;

export type RenderState = (typeof RENDER_STATES)[number];

export const isRenderState = (value: string): value is RenderState =>
	(RENDER_STATES as readonly string[]).includes(value);

export const STEP_LABELS = ["Open", "Snapshot", "Scoring", "Ranked", "Complete"] as const;

const STEP_INDEX: Record<string, number> = {
	open: 0,
	snapshotted: 1,
	scoring: 2,
	scored: 3,
	locked: 3,
	complete: 4
};

export const stepIndexFor = (state: RenderState): number => STEP_INDEX[state] ?? 0;

// `draft`/`not_found` render bare; every other state renders inside the global shell.
export const showsShell = (state: RenderState): boolean =>
	state !== "draft" && state !== "not_found";

// Maps a raw contest.status onto a render state; an unknown status falls back to `draft`.
export const phaseForStatus = (status: string): RenderState =>
	isRenderState(status) ? status : "draft";
