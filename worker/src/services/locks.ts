import { pool } from "@prompt-battle/db";

import { advisoryLockKeys } from "$src/utilities/locks";

// Serializes worker operations on a single contest with a Postgres session advisory lock. The
// long-running commands (score, advance) hold it for their whole run; reset/delete try to take
// it and fail fast if a job is active — so a reset can't race in-flight scoring or bracket
// writes. The lock releases on unlock, or when the session ends (e.g. a crash), so it never
// sticks across runs.
export const withContestLock = async <T>(contestId: string, fn: () => Promise<T>): Promise<T> => {
	const [keyA, keyB] = advisoryLockKeys(contestId);
	const client = await pool.connect();

	try {
		const { rows } = await client.query("select pg_try_advisory_lock($1, $2) as locked", [
			keyA,
			keyB
		]);

		if (!rows[0]?.locked) {
			throw new Error(`Another worker operation is already running for contest ${contestId}.`);
		}

		try {
			return await fn();
		} finally {
			await client.query("select pg_advisory_unlock($1, $2)", [keyA, keyB]);
		}
	} finally {
		client.release();
	}
};
