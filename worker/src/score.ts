import { parseArgs } from "node:util";

import { scoreContest } from "$src/services/scoring";

export const runScore = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const result = await scoreContest(contestId);

	if (result.skipped) {
		console.log(`Contest ${contestId} is not ready for scoring (status: ${result.status}).`);
		return;
	}

	console.log(`Scored contest ${contestId}`);
	console.log(`  calls:     ${result.total}`);
	console.log(`  completed: ${result.completed}`);
	console.log(`  failed:    ${result.failed}`);
};
