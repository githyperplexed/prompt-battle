import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { verifyAuditBundle } from "$src/utilities/verify-bundle";

export const runVerify = async () => {
	const { values } = parseArgs({
		options: { file: { type: "string" } },
		allowPositionals: true,
		strict: true
	});

	const file = values.file;

	if (!file) throw new Error("--file <path to audit bundle> is required");

	const bytes = readFileSync(file);

	console.log(`Verifying ${file}`);
	console.log(`  sha256: ${createHash("sha256").update(bytes).digest("hex")}`);
	console.log("");

	const report = verifyAuditBundle(JSON.parse(bytes.toString("utf8")));

	for (const check of report.checks) {
		console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.id}. ${check.title}`);
		console.log(`        ${check.detail}`);

		for (const note of check.notes) console.log(`        note: ${note}`);
	}

	console.log("");

	if (report.pass) {
		console.log("All checks passed — the published result follows from this record.");
	} else {
		console.log("VERIFICATION FAILED — this record does not support the published result.");
		process.exitCode = 1;
	}
};
