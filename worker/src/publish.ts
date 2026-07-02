import { parseArgs } from "node:util";

import { parseIsoTimestamp } from "$src/utilities/args";
import { publishContest } from "$src/services/contests";

export const runPublish = async () => {
	const { values } = parseArgs({
		options: {
			contest: { type: "string" },
			at: { type: "string" },
			unpublish: { type: "boolean" }
		},
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	if (values.unpublish) {
		await publishContest(contestId, null);
		console.log(`Unpublished contest ${contestId}; results are embargoed again.`);
		return;
	}

	const at = values.at ? parseIsoTimestamp(values.at, "--at") : new Date();
	const result = await publishContest(contestId, at);

	if (result.skipped) {
		console.log(
			`Contest ${contestId} cannot be published from status ${result.status} (needs scored or complete).`
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		at.getTime() > Date.now()
			? `Scheduled contest ${contestId} to publish at ${at.toISOString()}; embargoed until then.`
			: `Published contest ${contestId} at ${at.toISOString()}; results are now public.`
	);
};
