import { parseArgs } from "node:util";

import { advanceContest, resetBracket } from "$src/services/bracket";

export const runAdvance = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, "reset-bracket": { type: "boolean" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	if (values["reset-bracket"]) {
		const result = await resetBracket(contestId);

		if (result.skipped) {
			console.log(
				`Contest ${contestId} bracket cannot be reset unless it is scored (status: ${result.status}).`
			);
			return;
		}

		console.log(`Reset private bracket state for contest ${contestId}.`);
		console.log("Run advance again without --reset-bracket to start a clean bracket.");
		return;
	}

	const result = await advanceContest(contestId);

	if (result.skipped) {
		console.log(`Contest ${contestId} is not ready for the bracket (status: ${result.status}).`);
		return;
	}

	console.log(`Advanced contest ${contestId}`);
	console.log(`  entrants:    ${result.entrants}`);
	console.log(`  rounds:      ${result.rounds}`);
	console.log(`  champion:    ${result.champion ?? "(none)"}`);
	console.log(`  fingerprint: ${result.fingerprint}`);
};
