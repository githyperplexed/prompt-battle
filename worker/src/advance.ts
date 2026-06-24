import { parseArgs } from "node:util";

import { advanceContest } from "$src/services/bracket";

export const runAdvance = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const result = await advanceContest(contestId);

	if (result.skipped) {
		console.log(`Contest ${contestId} is not ready for the bracket (status: ${result.status}).`);
		return;
	}

	console.log(`Advanced contest ${contestId}`);
	console.log(`  entrants: ${result.entrants}`);
	console.log(`  rounds:   ${result.rounds}`);
	console.log(`  champion: ${result.champion ?? "(none)"}`);
};
