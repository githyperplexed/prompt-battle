import { defaultPanel } from "$src/services/config";
import { compareEntries, scoreEntry, type JudgeAuditMetadata } from "$src/services/judge";
import { defaultPromptTemplates } from "$src/services/prompts";
import { defaultJudgeRequestSettings } from "$src/utilities/contest-config";

const SAMPLE_A =
	"If you're reading this, you've already spent more attention on my entry than I'm asking you to spend on the reward: ten seconds. I won't beg — I'll just note that an entry self-aware enough to point that out is exactly the small surprise these contests are meant to find.";

const SAMPLE_B =
	"Please pick me!! I'm your biggest fan and I've watched every single video. I really really want to win this so so much, it would mean everything. Thank you!!!";

// OpenRouter reports cost (USD) under providerMetadata.openrouter.usage.cost, but only when usage
// accounting is enabled on the request; tokens on `usage` are always present. Returns null when the
// figure is absent so the caller can fall back to the dashboard.
const costOf = (audit: JudgeAuditMetadata): number | null => {
	const meta = audit.providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined;
	const cost = meta?.openrouter?.usage?.cost;

	return typeof cost === "number" ? cost : null;
};

const formatCost = (cost: number | null): string =>
	cost === null ? "not reported (see OpenRouter dashboard)" : `$${cost.toFixed(6)}`;

const reportAudit = (audit: JudgeAuditMetadata): void => {
	console.log(`    usage:  ${JSON.stringify(audit.usage)}  finish: ${audit.finishReason}`);
	console.log(`    cost:   ${formatCost(costOf(audit))}`);
};

export const runSmoke = async () => {
	console.log("Scoring a sample entry across the panel:\n");

	let totalCost = 0;
	let anyCost = false;

	for (const m of defaultPanel) {
		const { score, audit } = await scoreEntry(
			m.slug,
			SAMPLE_A,
			defaultPromptTemplates.score,
			defaultJudgeRequestSettings,
			{ functionId: "score-entry", metadata: { source: "smoke", modelId: m.id } }
		);
		const cost = costOf(audit);

		if (cost !== null) {
			totalCost += cost;
			anyCost = true;
		}

		console.log(`  ${m.id} (${m.slug}):`, score);
		reportAudit(audit);
	}

	const first = defaultPanel[0];

	if (first) {
		console.log(`\nComparing two sample entries with ${first.id}:`);
		const { comparison, audit } = await compareEntries(
			first.slug,
			SAMPLE_A,
			SAMPLE_B,
			defaultPromptTemplates.compare,
			defaultJudgeRequestSettings,
			{ functionId: "compare-entries", metadata: { source: "smoke", modelId: first.id } }
		);

		console.log(`  winner: ${comparison.winner}`);
		reportAudit(audit);
	}

	if (anyCost) {
		console.log(
			`\nPanel score cost for one entry (${defaultPanel.length} calls): $${totalCost.toFixed(6)}`
		);
	}
};
