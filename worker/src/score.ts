import { parseArgs } from "node:util";

import { scoreContest } from "$src/services/scoring";

export const runScore = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, "allow-unscorable": { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	// Single-run guardrail override: after reviewing a suppressed run's reported refusals, the
	// operator can accept up to this many unscorable disqualifications.
	let allowUnscorable: number | undefined;

	if (values["allow-unscorable"] !== undefined) {
		allowUnscorable = Number(values["allow-unscorable"]);

		if (!Number.isInteger(allowUnscorable) || allowUnscorable < 0) {
			throw new Error("--allow-unscorable must be a non-negative integer");
		}
	}

	const result = await scoreContest(contestId, { allowUnscorable });

	if (result.skipped) {
		console.log(`Contest ${contestId} is not ready for scoring (status: ${result.status}).`);
		return;
	}

	console.log(`Scored contest ${contestId}`);
	console.log(`  calls:     ${result.total}`);
	console.log(`  completed: ${result.completed}`);
	console.log(`  failed:    ${result.failed}`);

	if (result.unscorable.length > 0) {
		if (result.unscorableSuppressed) {
			console.error(
				`  unscorable: ${result.unscorable.length} of ${result.eligible} eligible entries — ` +
					"guardrail tripped, nothing was disqualified."
			);
			console.error(
				"      Refusals this widespread point to a systemic cause (judge prompt, schema, token" +
					" limit, provider), not entry content. Fix the cause and re-run; every pair is still" +
					" retryable."
			);
			console.error(
				"      If you review the entries below and judge every refusal genuine, re-run with" +
					` --allow-unscorable ${result.unscorable.length} to accept the disqualifications.`
			);
		} else {
			console.log(
				`  unscorable: ${result.unscorable.length} (disqualified — a panel model refused to score them)`
			);
		}

		for (const { entryId, detail } of result.unscorable) {
			console.log(`      ${entryId} — ${detail}`);
		}
	}

	if (!result.complete) {
		console.error(
			"Scoring is incomplete; " + result.missing.length + " expected score(s) are missing."
		);

		if (result.unexpected.length > 0) {
			console.error(
				"Found " + result.unexpected.length + " score(s) from unexpected panel model(s)."
			);
		}

		process.exitCode = 1;
	}
};
