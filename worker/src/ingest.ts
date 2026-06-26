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
		const results = await snapshotDueContests({ maxEntries, maxComments, skipModeration });

		if (results.length === 0) {
			console.log("No contests are due for snapshot.");
			return;
		}

		for (const r of results) {
			const detail = r.skipped
				? `skipped (${r.status})`
				: `stored ${r.stored}, eligible ${r.eligible}`;
			console.log(`${r.id}: ${detail}`);
		}

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
};
