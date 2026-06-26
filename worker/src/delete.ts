import { parseArgs } from "node:util";

import { deleteContest } from "$src/services/contests";

export const runDelete = async () => {
	const { values } = parseArgs({
		options: { contest: { type: "string" }, force: { type: "boolean" } },
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	if (!values.force) {
		throw new Error(
			`Refusing to delete contest ${contestId} without --force; this cascades all entries, scores, and bracket rows.`
		);
	}

	await deleteContest(contestId);

	console.log(`Deleted contest ${contestId} and all of its data.`);
};
