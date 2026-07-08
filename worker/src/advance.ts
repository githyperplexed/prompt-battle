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
	console.log(`  entrants:    ${result.entrants}`);
	console.log(`  rounds:      ${result.rounds}`);
	console.log(`  champion:    ${result.champion ?? "(none)"}`);
	console.log(`  fingerprint: ${result.fingerprint}`);

	if (result.refusals.length > 0) {
		console.log(
			`  refusals:    ${result.refusals.length} comparison(s) refused — that model's votes were` +
				" discarded for the affected matchup"
		);

		for (const r of result.refusals) {
			console.log(
				`      r${r.round} s${r.slot} ${r.modelId}${r.orderSwapped ? " (swapped order)" : ""} — ${r.detail}`
			);
		}
	}
};
