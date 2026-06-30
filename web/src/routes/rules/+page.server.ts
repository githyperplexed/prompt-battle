import { loadActiveVerification } from "$lib/server/contest";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const verification = await loadActiveVerification();

	return { verification };
};
