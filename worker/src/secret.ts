import { parseArgs } from "node:util";

import { keywordHash, parseKeywordList } from "$src/utilities/keywords";
import { mintSalt, writeKeywordSecret } from "$src/services/secrets";

export const runSecret = async () => {
	const { values } = parseArgs({
		options: {
			video: { type: "string" },
			keywords: { type: "string" },
			salt: { type: "string" },
			force: { type: "boolean" }
		},
		allowPositionals: true,
		strict: true
	});

	const videoId = values.video;

	if (!videoId) throw new Error("--video <youtube-video-id> is required");
	if (!values.keywords) throw new Error("--keywords <one,two,three> is required");

	const keywords = parseKeywordList(values.keywords);
	const salt = values.salt ?? mintSalt();
	const path = writeKeywordSecret(videoId, { keywords, salt }, values.force ?? false);

	console.log(`Wrote ${path}`);
	console.log(`  keywords:  ${keywords.join(", ")}`);
	console.log(`  salt:      ${salt}`);
	console.log(`  hash:      ${keywordHash(keywords, salt)}`);
	console.log(
		"\nKEYWORD_SECRETS entry for the deployed ingest cron (merge into the existing map):"
	);
	console.log(`  ${JSON.stringify({ [videoId]: { keywords, salt } })}`);
};
