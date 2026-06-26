export const RESET_TARGETS = ["open", "snapshotted", "scored"] as const;

export type ResetTarget = (typeof RESET_TARGETS)[number];

export const isResetTarget = (value: string): value is ResetTarget =>
	(RESET_TARGETS as readonly string[]).includes(value);

// A reset to a target deletes everything produced after that stage, so it is only valid from
// a status strictly past the target. Resetting to `scored` is also allowed from `scored`
// itself, to clear a partial bracket left by an interrupted advance.
const ALLOWED_FROM: Record<ResetTarget, ReadonlySet<string>> = {
	open: new Set(["snapshotted", "scoring", "scored", "complete"]),
	snapshotted: new Set(["scoring", "scored", "complete"]),
	scored: new Set(["scored", "complete"])
};

export const canResetTo = (current: string, target: ResetTarget): boolean =>
	ALLOWED_FROM[target].has(current);
