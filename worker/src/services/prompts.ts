import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { PromptSections } from "$src/utilities/prompts";

const loadTemplate = (file: string): PromptSections => {
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

export const defaultPromptTemplates = {
	score: loadTemplate("judge-score.md"),
	compare: loadTemplate("judge-compare.md")
};
