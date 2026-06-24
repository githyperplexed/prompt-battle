import { panel } from "./config";
import { compareEntries, scoreEntry } from "./services/judge";

const SAMPLE_A =
	"If you're reading this, you've already spent more attention on my entry than I'm asking you to spend on the reward: ten seconds. I won't beg — I'll just note that an entry self-aware enough to point that out is exactly the small surprise these contests are meant to find.";

const SAMPLE_B =
	"Please pick me!! I'm your biggest fan and I've watched every single video. I really really want to win this so so much, it would mean everything. Thank you!!!";

export const runSmoke = async () => {
	console.log("Scoring a sample entry across the panel:\n");

	for (const m of panel) {
		const score = await scoreEntry(m.slug, SAMPLE_A);
		console.log(`  ${m.id} (${m.slug}):`, score);
	}

	const first = panel[0];

	if (first) {
		console.log(`\nComparing two sample entries with ${first.id}:`);
		const verdict = await compareEntries(first.slug, SAMPLE_A, SAMPLE_B);
		console.log(`  winner: ${verdict.winner}`);
	}
};
