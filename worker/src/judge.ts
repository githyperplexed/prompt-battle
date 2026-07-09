import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { MAX_CHARS, MIN_CHARS } from "$src/constants";
import { defaultPanel } from "$src/services/config";
import { scoreEntry } from "$src/services/judge";
import { defaultPromptTemplates } from "$src/services/prompts";
import { defaultJudgeRequestSettings } from "$src/utilities/contest-config";
import { judgeCallCost } from "$src/utilities/judge";
import { aggregateTotals } from "$src/utilities/ranking";
import { countCharacters } from "$src/utilities/validation";

// Scores one draft entry across the default panel and prints the rubric — a drafting aid,
// not part of the contest pipeline. Uses the repo defaults (config.json, prompts/), never a
// frozen contest config, and touches no database state.
export const runJudge = async () => {
	const { values } = parseArgs({
		options: {
			text: { type: "string" },
			file: { type: "string" }
		},
		allowPositionals: true,
		strict: true
	});

	if ((values.text === undefined) === (values.file === undefined)) {
		throw new Error('Provide exactly one of --text "<entry>" or --file <path>');
	}

	const text = (values.text ?? readFileSync(values.file!, "utf8")).trim();

	if (!text) throw new Error("The entry text is empty");

	const chars = countCharacters(text);

	console.log(`Judging entry (${chars} chars) across the default panel:\n`);

	if (chars < MIN_CHARS || chars > MAX_CHARS) {
		console.log(
			`  warning: outside the eligible ${MIN_CHARS}–${MAX_CHARS} char range — a real contest would disqualify this text\n`
		);
	}

	const totals: number[] = [];
	let totalCost = 0;
	let anyCost = false;

	for (const m of defaultPanel) {
		const { score, audit } = await scoreEntry(
			m.slug,
			text,
			defaultPromptTemplates.score,
			defaultJudgeRequestSettings,
			{ functionId: "score-entry", metadata: { source: "judge", modelId: m.id } }
		);
		const total = score.persuasiveness + score.originality + score.cleverness + score.execution;
		const cost = judgeCallCost(audit);

		totals.push(total);

		if (cost !== null) {
			totalCost += cost;
			anyCost = true;
		}

		console.log(`  ${m.id} (${m.slug})`);
		console.log(
			`    persuasiveness ${score.persuasiveness}   originality ${score.originality}   ` +
				`cleverness ${score.cleverness}   execution ${score.execution}   total ${total}`
		);
	}

	const mean = aggregateTotals(totals).absoluteScore;

	console.log(`\nRaw absolute score (mean of ${totals.length} model totals): ${mean}`);

	if (anyCost) console.log(`Panel cost (${totals.length} calls): $${totalCost.toFixed(6)}`);
};
