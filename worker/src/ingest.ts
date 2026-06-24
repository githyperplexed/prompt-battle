import { parseArgs } from "node:util";

import { snapshotContest, snapshotDueContests } from "./services/snapshot";

export const runIngest = async () => {
	const { values } = parseArgs({
		options: {
			contest: { type: "string" },
			due: { type: "boolean" }
		},
		allowPositionals: true,
		strict: true
	});

	if (values.due) {
		const results = await snapshotDueContests();

		if (results.length === 0) {
			console.log("No contests are due for snapshot.");
			return;
		}

		for (const r of results) {
			const detail = r.skipped
				? `skipped (${r.status})`
				: `stored ${r.stored}, eligible ${r.eligible}`;
			console.log(`${r.id}: ${detail}`);
		}

		return;
	}

	const contestId = values.contest;

	if (!contestId) throw new Error("Provide --contest <id> or --due");

	const result = await snapshotContest(contestId);

	if (result.skipped) {
		console.log(`Contest ${contestId} is not open (status: ${result.status}); nothing to do.`);
		return;
	}

	console.log(`Snapshotted contest ${contestId}`);
	console.log(`  fetched:  ${result.total}`);
	console.log(`  stored:   ${result.stored}`);
	console.log(`  eligible: ${result.eligible}`);
};
