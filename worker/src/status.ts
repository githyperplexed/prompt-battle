import { parseArgs } from "node:util";

import { listContestSummaries, loadStatusReport } from "$src/services/status";
import { formatContestList, formatStatusReport } from "$src/utilities/status";

export const runStatus = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, json: { type: "boolean" } },
		allowPositionals: true,
		strict: true
	});

	if (values.contest) {
		const report = await loadStatusReport(values.contest);

		if (!report) {
			console.error(`No contest with id ${values.contest}`);
			process.exitCode = 1;
			return;
		}

		if (values.json) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}

		for (const line of formatStatusReport(report)) console.log(line);
		return;
	}

	const summaries = await listContestSummaries();

	if (values.json) {
		console.log(JSON.stringify(summaries, null, 2));
		return;
	}

	// With a single contest, the detail view is what you want; otherwise list them.
	if (summaries.length === 1) {
		const report = await loadStatusReport(summaries[0]!.id);

		if (report) for (const line of formatStatusReport(report)) console.log(line);
		return;
	}

	for (const line of formatContestList(summaries)) console.log(line);
};
