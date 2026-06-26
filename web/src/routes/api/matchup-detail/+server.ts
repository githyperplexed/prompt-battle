import { json } from "@sveltejs/kit";

import { loadMatchupDetail } from "$lib/server/contest";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const detail = await loadMatchupDetail(
		url.searchParams.get("contest") ?? "",
		url.searchParams.get("matchup") ?? ""
	);

	if (!detail) return json({ error: "Matchup not found" }, { status: 404 });

	return json(detail);
};
