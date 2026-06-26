import { createHash } from "node:crypto";

// Two stable 32-bit keys for Postgres `pg_advisory_lock(int4, int4)`, derived from a contest id.
export const advisoryLockKeys = (contestId: string): [number, number] => {
	const digest = createHash("sha256").update(contestId).digest();

	return [digest.readInt32BE(0), digest.readInt32BE(4)];
};
