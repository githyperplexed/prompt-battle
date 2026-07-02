import { parseArgs } from "node:util";

import { parsePositiveInt } from "$src/utilities/args";
import { snapshotContest, snapshotDueContests } from "$src/services/snapshot";

export const runIngest = async () => {
	const { values } = parseArgs({
		options: {
			contest: { type: "string" },
			due: { type: "boolean" },
			"max-entries": { type: "string" },
			"max-comments": { type: "string" },
			"skip-moderation": { type: "boolean" }
		},
		allowPositionals: true,
		strict: true
	});

	const maxEntries = parsePositiveInt(values["max-entries"], "--max-entries");
	const maxComments = parsePositiveInt(values["max-comments"], "--max-comments");
	const skipModeration = values["skip-moderation"] ?? false;

	if (skipModeration) {
		console.warn("⚠ --skip-moderation set: entries are NOT screened for policy violations.");
	}

	if (values.due) {
		if (values.contest) throw new Error("--due and --contest are mutually exclusive");

		const results = await snapshotDueContests({ maxEntries, maxComments, skipModeration });

		if (results.length === 0) {
			console.log("No contests are due for snapshot.");
			return;
		}

		let failed = 0;

		for (const r of results) {
			let detail: string;

			if ("failed" in r) {
				failed += 1;
				detail = `FAILED — ${r.error}`;
			} else if (r.skipped) {
				detail = `skipped (${r.status})`;
			} else {
				detail = `stored ${r.stored}, eligible ${r.eligible}`;
			}

			console.log(`${r.id}: ${detail}`);
		}

		if (failed > 0) process.exitCode = 1;

		return;
	}

	const contestId = values.contest;

	if (!contestId) throw new Error("Provide --contest <id> or --due");

	const result = await snapshotContest(contestId, { maxEntries, maxComments, skipModeration });

	if (result.skipped) {
		console.log(`Contest ${contestId} is not open (status: ${result.status}); nothing to do.`);
		return;
	}

	const duplicates = result.total - result.afterCutoff - result.unique;

	console.log(`Snapshotted contest ${contestId}`);
	console.log(`  fetched:      ${result.total}`);
	console.log(`  after cutoff: ${result.afterCutoff}`);
	console.log(`  duplicates:   ${duplicates}`);
	console.log(`  unique:       ${result.unique}`);
	console.log(`  stored:       ${result.stored}`);
	console.log(`  eligible:     ${result.eligible}`);

	if (result.overCap > 0) {
		console.log(`  over cap:     ${result.overCap} (stored as disqualified "over_cap")`);
	}
};
