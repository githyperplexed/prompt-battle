import { loadActiveVerification } from "$lib/server/contest";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
	const verification = await loadActiveVerification();

	// The bundle is a committed static asset, so it can lag publish by one deploy — link it only
	// once the file is actually served, and never before the embargo lifts.
	if (verification?.published) {
		const url = `/audit/${verification.videoId}.json`;
		const head = await fetch(url, { method: "HEAD" });

		if (head.ok) verification.auditBundleUrl = url;
	}

	return { verification };
};
