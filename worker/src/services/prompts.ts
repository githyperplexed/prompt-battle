import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { makeNonce, replaceTokens } from "../utilities/text";

type Sections = { system: string; user: string };

const loadTemplate = (file: string): Sections => {
	const path = fileURLToPath(new URL(`../../../prompts/${file}`, import.meta.url));
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
};

const scoreTemplate = loadTemplate("judge-score.md");
const compareTemplate = loadTemplate("judge-compare.md");

export const buildScoreMessages = (entryText: string): Sections & { nonce: string } => {
	const nonce = makeNonce();
	const user = replaceTokens(scoreTemplate.user.split("{{NONCE}}").join(nonce), {
		"{{ENTRY_TEXT}}": entryText
	});

	return { system: scoreTemplate.system, user, nonce };
};

export const buildCompareMessages = (entryA: string, entryB: string): Sections => {
	const nonceA = makeNonce();
	let nonceB = makeNonce();

	while (nonceB === nonceA) nonceB = makeNonce(); // the two markers must differ

	const templated = compareTemplate.user
		.split("{{NONCE_A}}")
		.join(nonceA)
		.split("{{NONCE_B}}")
		.join(nonceB);
	// Both entries inserted in one pass so neither's content can hit the other's token.
	const user = replaceTokens(templated, { "{{ENTRY_A}}": entryA, "{{ENTRY_B}}": entryB });

	return { system: compareTemplate.system, user };
};
