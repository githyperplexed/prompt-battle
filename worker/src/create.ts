import { parseArgs } from "node:util";

import { panel } from "$src/config";
import { createContest } from "$src/services/contests";
import { loadKeywordSecret } from "$src/services/secrets";
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

	const created = await createContest({
		videoId,
		videoPublishedAt,
		snapshotAt,
		config: { keywordHash: hash, panel }
	});

	console.log(`Created contest ${created.id}`);
	console.log(`  video:        ${created.videoId}`);
	console.log(`  snapshot at:  ${created.snapshotAt.toISOString()}`);
	console.log(`  keyword hash: ${hash}`);
};
