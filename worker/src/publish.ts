import { parseArgs } from "node:util";

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

	const at = values.at ? new Date(values.at) : new Date();

	if (Number.isNaN(at.getTime())) throw new Error("--at must be a valid ISO timestamp");

	const result = await publishContest(contestId, at);

	if (result.skipped) {
		console.log(
			`Contest ${contestId} cannot be published from status ${result.status} (needs scored or complete).`
		);
		return;
	}

	console.log(`Published contest ${contestId} at ${at.toISOString()}; results are now public.`);
};
