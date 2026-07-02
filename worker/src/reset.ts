import { parseArgs } from "node:util";

import { resetContest } from "$src/services/contests";
import { isResetTarget, RESET_TARGETS } from "$src/utilities/contest-status";

export const runReset = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, to: { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const to = values.to;

	if (!to || !isResetTarget(to)) {
		throw new Error(`--to must be one of: ${RESET_TARGETS.join(", ")}`);
	}

	const result = await resetContest(contestId, to);

	if (result.skipped) {
		console.log(`Contest ${contestId} cannot reset to ${to} from status ${result.status}.`);
		process.exitCode = 1;
		return;
	}

	console.log(`Reset contest ${contestId}: ${result.from} → ${result.to}`);
};
