import { json } from "@sveltejs/kit";

import { searchEntry } from "$lib/server/contest";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const result = await searchEntry(
		url.searchParams.get("contest") ?? "",
		url.searchParams.get("q") ?? ""
	);

	return json(result);
};
