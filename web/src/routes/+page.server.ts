import { loadResults } from "$lib/server/results";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => loadResults();
