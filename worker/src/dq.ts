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
	// Resolved id → the token the operator typed, so warnings speak in their terms.
	let labelById: Map<string, string>;

	if (reason === "affiliated") {
		if (values.comment)
			throw new Error("--comment is not valid with --reason affiliated; use --channel");

		const tokens = parseChannelList(values.channel);

		if (tokens.length === 0)
			throw new Error("--reason affiliated requires --channel <@handle|UC…,…>");

		// Import lazily so the tos path never loads the YouTube client (which requires an API key).
		const { resolveChannelTokens } = await import("$src/services/excluded");
		const idByToken = await resolveChannelTokens(tokens);

		labelById = new Map([...idByToken].map(([token, id]) => [id, token]));
		selector = { by: "channel", ids: [...labelById.keys()] };
	} else {
		if (values.channel) throw new Error("--channel is not valid with --reason tos; use --comment");

		const ids = parseCsv(values.comment);

		if (ids.length === 0) throw new Error("--reason tos requires --comment <youtubeCommentId,…>");

		labelById = new Map(ids.map((id) => [id, id]));
		selector = { by: "comment", ids };
	}

	const result = await disqualifyEntries(contestId, reason, selector, note);

	if (result.skipped) {
		console.log(
			`Contest ${contestId} is ${result.status}; manual DQ is only allowed while snapshotted (before scoring). Reset to snapshotted first if you must DQ after scoring.`
		);
		process.exitCode = 1;

		return;
	}

	console.log(
		`Disqualified ${result.count} entr${result.count === 1 ? "y" : "ies"} as "${reason}" in contest ${contestId}.`
	);

	const unmatched = [...labelById]
		.filter(([id]) => !result.matched.includes(id))
		.map(([, label]) => label);

	if (unmatched.length > 0) {
		console.warn(`No eligible entry matched: ${unmatched.join(", ")}`);
	}
};
