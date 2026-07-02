import { z } from "zod";

// Coerces the raw flag string and enforces a positive integer; absent flags pass through as
// undefined so callers fall back to their defaults.
const positiveIntFlag = z.coerce.number().int().positive().optional();

export const parsePositiveInt = (raw: string | undefined, label: string): number | undefined => {
	const result = positiveIntFlag.safeParse(raw);

	if (!result.success) throw new Error(`${label} must be a positive integer`);

	return result.data;
};

// `new Date(string)` parses an offset-less timestamp as LOCAL machine time — around a
// coordinated cutoff or reveal that is a silent multi-hour error. Require the offset.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/;

export const parseIsoTimestamp = (raw: string, label: string): Date => {
	if (!ISO_WITH_OFFSET.test(raw)) {
		throw new Error(
			`${label} must be an ISO timestamp with an explicit offset, e.g. 2026-07-04T18:00:00Z`
		);
	}

	const date = new Date(raw);

	if (Number.isNaN(date.getTime())) throw new Error(`${label} is not a valid timestamp`);

	return date;
};
