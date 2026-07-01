// The five lifecycle phases that share a contest.status value.
export const PHASES = ["open", "snapshotted", "scoring", "scored", "complete"] as const;

export type Phase = (typeof PHASES)[number];

// Everything the page can render, including UI-only states with no contest.status equivalent
// (`locked` = results embargoed, `upcoming` = a phase the contest hasn't reached yet, `draft`/
// `not_found` = pre-open / missing).
export const RENDER_STATES = [...PHASES, "locked", "upcoming", "draft", "not_found"] as const;

export type RenderState = (typeof RENDER_STATES)[number];

export const isRenderState = (value: string): value is RenderState =>
	(RENDER_STATES as readonly string[]).includes(value);

export const isPhase = (value: string): value is Phase =>
	(PHASES as readonly string[]).includes(value);

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

// The query params each render state reads. Params absent from the destination phase's list are
// stale on navigation, so they get dropped rather than leaking from one phase's URL into another.
const PHASE_PARAMS: Partial<Record<RenderState, readonly string[]>> = {};

export const paramsForPhase = (state: RenderState): readonly string[] => PHASE_PARAMS[state] ?? [];

// Query string for navigating to `target`, keeping the `phase` selector, the sticky dev `peek` flag,
// and the params the target phase itself owns. Every other phase's leftover params are discarded.
export const phaseQuery = (current: URLSearchParams, target: RenderState): string => {
	const next = new URLSearchParams();
	next.set("phase", target);

	const peek = current.get("peek");
	if (peek !== null) next.set("peek", peek);

	for (const key of paramsForPhase(target)) {
		const value = current.get(key);

		if (value !== null) next.set(key, value);
	}

	return `?${next}`;
};
