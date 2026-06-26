import { z } from "zod";

// Coerces the raw flag string and enforces a positive integer; absent flags pass through as
// undefined so callers fall back to their defaults.
const positiveIntFlag = z.coerce.number().int().positive().optional();

export const parsePositiveInt = (raw: string | undefined, label: string): number | undefined => {
	const result = positiveIntFlag.safeParse(raw);

	if (!result.success) throw new Error(`${label} must be a positive integer`);

	return result.data;
};
