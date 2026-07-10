import { parseArgs } from "node:util";

import { exportContest } from "$src/services/export";

export const runExport = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, out: { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const result = await exportContest(contestId, { out: values.out });

	if (result.skipped) {
		console.log(`Contest ${contestId} cannot be exported (${result.reason}).`);
		process.exitCode = 1;
		return;
	}

	console.log(`Exported audit bundle for contest ${contestId}`);
	console.log(`  file:        ${result.path}`);
	console.log(`  sha256:      ${result.hash}`);
	console.log(`  entries:     ${result.entries}`);
	console.log(`  scores:      ${result.scores}`);
	console.log(`  similarity:  ${result.similarities}`);
	console.log(`  matchups:    ${result.matchups} (${result.comparisons} comparisons)`);
	console.log("Commit and push the file to deploy it — the commit is the public anchor.");
};
