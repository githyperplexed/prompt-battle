import { parseArgs } from "node:util";

import { clusterContest } from "$src/services/similarity";

export const runCluster = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, "store-vectors": { type: "boolean" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const result = await clusterContest(contestId, {
		storeVectors: values["store-vectors"] ?? false
	});

	if (result.skipped) {
		const reason = result.reason
			? ` (${result.reason})`
			: result.status
				? ` (status: ${result.status})`
				: "";
		console.log(`Contest ${contestId} is not ready for clustering${reason}.`);
		return;
	}

	console.log(`Clustered contest ${contestId}`);
	console.log(`  entries:         ${result.entries}`);
	console.log(`  penalized:       ${result.penalized}`);
	console.log(`  clusters:        ${result.clusters}`);
	console.log(`  largest cluster: ${result.largestCluster}`);
	console.log(`  fingerprint:     ${result.fingerprint}`);
};
