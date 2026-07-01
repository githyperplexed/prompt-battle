import { parseArgs } from "node:util";

import { disqualifyEntries, type DqSelector } from "$src/services/disqualify";
import { parseChannelList, parseCsv } from "$src/utilities/channels";

// Manual, discretionary disqualification after ingest but before scoring. Restricted to
// `affiliated` (whole channels, via --channel) and `tos` (specific entries, via --comment) — the
// two operator-judgment reasons the rules already allow. Mechanical reasons stay computed at ingest.
export const runDq = async () => {
	const { values } = parseArgs({
		options: {
			contest: { type: "string" },
			reason: { type: "string" },
			channel: { type: "string" },
			comment: { type: "string" },
			note: { type: "string" }
		},
		allowPositionals: true,
		strict: true
	});

	const contestId = values.contest;

	if (!contestId) throw new Error("--contest <id> is required");

	const reason = values.reason;

	if (reason !== "affiliated" && reason !== "tos") {
		throw new Error('--reason must be "affiliated" (with --channel) or "tos" (with --comment)');
	}

	const note = values.note?.trim();

	if (!note) throw new Error('--note "<why>" is required — it records why the entry was removed');

	let selector: DqSelector;
	let requested: string[];

	if (reason === "affiliated") {
		if (values.comment)
			throw new Error("--comment is not valid with --reason affiliated; use --channel");

		const tokens = parseChannelList(values.channel);

		if (tokens.length === 0)
			throw new Error("--reason affiliated requires --channel <@handle|UC…,…>");

		// Import lazily so the tos path never loads the YouTube client (which requires an API key).
		const { resolveChannelTokens } = await import("$src/services/excluded");

		requested = [...(await resolveChannelTokens(tokens))];

		if (requested.length === 0) throw new Error("No channels resolved from --channel");

		selector = { by: "channel", ids: requested };
	} else {
		if (values.channel) throw new Error("--channel is not valid with --reason tos; use --comment");

		requested = parseCsv(values.comment);

		if (requested.length === 0)
			throw new Error("--reason tos requires --comment <youtubeCommentId,…>");

		selector = { by: "comment", ids: requested };
	}

	const result = await disqualifyEntries(contestId, reason, selector, note);

	if (result.skipped) {
		console.log(
			`Contest ${contestId} is ${result.status}; manual DQ is only allowed while snapshotted (before scoring). Reset to snapshotted first if you must DQ after scoring.`
		);

		return;
	}

	console.log(
		`Disqualified ${result.count} entr${result.count === 1 ? "y" : "ies"} as "${reason}" in contest ${contestId}.`
	);

	const unmatched = requested.filter((id) => !result.matched.includes(id));

	if (unmatched.length > 0) {
		console.warn(`No eligible entry matched: ${unmatched.join(", ")}`);
	}
};
