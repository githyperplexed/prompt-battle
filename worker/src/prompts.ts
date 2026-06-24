import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Sections = { system: string; user: string };

function loadTemplate(file: string): Sections {
	const path = fileURLToPath(new URL(`../../prompts/${file}`, import.meta.url));
	// Strip HTML comments first — the header notes also contain the "## System message"
	// and "## User message" markers, which would otherwise confuse the section split.
	const raw = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");

	const sysMarker = "## System message";
	const userMarker = "## User message";
	const sysIdx = raw.indexOf(sysMarker);
	const userIdx = raw.indexOf(userMarker);
	if (sysIdx === -1 || userIdx === -1 || userIdx < sysIdx) {
		throw new Error(`Prompt template ${file} is missing System/User sections`);
	}

	const system = raw.slice(sysIdx + sysMarker.length, userIdx).trim();
	const user = raw.slice(userIdx + userMarker.length).trim();
	return { system, user };
}

const scoreTemplate = loadTemplate("judge-score.md");
const compareTemplate = loadTemplate("judge-compare.md");

function makeNonce(): string {
	return `BOUNDARY_${randomBytes(16).toString("hex")}`;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Insert untrusted entry text in a SINGLE pass so inserted content is never re-scanned
// for placeholders — a literal "{{...}}" inside an entry can never become a real delimiter.
function insertEntries(template: string, entries: Record<string, string>): string {
	const re = new RegExp(Object.keys(entries).map(escapeRegExp).join("|"), "g");
	return template.replace(re, (match) => entries[match] ?? match);
}

export function buildScoreMessages(entryText: string): Sections {
	// Nonce (trusted) substituted first; entry text (untrusted) inserted last.
	const nonce = makeNonce();
	const user = insertEntries(scoreTemplate.user.split("{{NONCE}}").join(nonce), {
		"{{ENTRY_TEXT}}": entryText
	});
	return { system: scoreTemplate.system, user };
}

export function buildCompareMessages(entryA: string, entryB: string): Sections {
	const nonceA = makeNonce();
	let nonceB = makeNonce();
	while (nonceB === nonceA) nonceB = makeNonce(); // the two markers must differ
	const templated = compareTemplate.user
		.split("{{NONCE_A}}")
		.join(nonceA)
		.split("{{NONCE_B}}")
		.join(nonceB);
	// Both entries inserted in one pass so neither's content can hit the other's token.
	const user = insertEntries(templated, { "{{ENTRY_A}}": entryA, "{{ENTRY_B}}": entryB });
	return { system: compareTemplate.system, user };
}
