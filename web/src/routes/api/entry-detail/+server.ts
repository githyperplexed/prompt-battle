import { json } from "@sveltejs/kit";

import { loadEntryDetail } from "$lib/server/contest";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const detail = await loadEntryDetail(
		url.searchParams.get("contest") ?? "",
		url.searchParams.get("entry") ?? ""
	);

	if (!detail) return json({ error: "Entry not found" }, { status: 404 });

	return json(detail);
};
