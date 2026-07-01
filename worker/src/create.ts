import { parseArgs } from "node:util";

import { defaultPanel } from "$src/services/config";
import { createContest } from "$src/services/contests";
import { defaultPromptTemplates } from "$src/services/prompts";
import { loadKeywordSecret } from "$src/services/secrets";
import { createContestConfig } from "$src/utilities/contest-config";
import { keywordHash } from "$src/utilities/keywords";

const HOUR_MS = 60 * 60 * 1000;

export const runCreate = async () => {
	const { values } = parseArgs({
		options: {
			video: { type: "string" },
			"published-at": { type: "string" },
			"snapshot-at": { type: "string" },
			"delay-hours": { type: "string" }
		},
		allowPositionals: true,
		strict: true
	});

	const videoId = values.video;

	if (!videoId) throw new Error("--video <youtube-video-id> is required");

	const publishedAtRaw = values["published-at"];

	if (!publishedAtRaw) throw new Error("--published-at <ISO timestamp> is required");

	const videoPublishedAt = new Date(publishedAtRaw);

	if (Number.isNaN(videoPublishedAt.getTime())) {
		throw new Error("--published-at must be a valid ISO timestamp");
	}

	const delayHours = values["delay-hours"] ? Number(values["delay-hours"]) : 168;
	const snapshotAt = values["snapshot-at"]
		? new Date(values["snapshot-at"])
		: new Date(videoPublishedAt.getTime() + delayHours * HOUR_MS);

	if (Number.isNaN(snapshotAt.getTime())) {
		throw new Error("--snapshot-at must be a valid ISO timestamp");
	}

	const secret = loadKeywordSecret(videoId);
	const hash = keywordHash(secret.keywords, secret.salt);
	const config = createContestConfig({
		keywordHash: hash,
		panel: defaultPanel,
		prompts: defaultPromptTemplates
	});

	const created = await createContest({
		videoId,
		videoPublishedAt,
		snapshotAt,
		config
	});

	console.log(`Created contest ${created.id}`);
	console.log(`  video:        ${created.videoId}`);
	console.log(`  snapshot at:  ${created.snapshotAt.toISOString()}`);
	console.log(`  keyword hash:  ${hash}`);
	console.log(`  score prompt:  ${config.prompts.score.hash}`);
	console.log(`  compare prompt: ${config.prompts.compare.hash}`);
	console.log(`  similarity:    ${config.similarity.hash}`);
};
