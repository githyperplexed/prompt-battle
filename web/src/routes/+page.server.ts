import { dev } from "$app/environment";

import {
	loadActiveContest,
	loadComplete,
	loadEntryList,
	loadLeaderboard,
	loadScoringStats,
	loadSnapshotStats
} from "$lib/server/contest";
import type { ContestMeta, ContestPageData } from "$lib/types/contest";
import { CONTEST_SUBTITLE, CONTEST_TITLE } from "$lib/utilities/copy";
import { isRenderState, phaseForStatus, type RenderState } from "$lib/utilities/phases";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }): Promise<ContestPageData> => {
	const contest = await loadActiveContest();

	if (!contest) return { state: "not_found", contest: null };

	const override = dev ? url.searchParams.get("phase") : null;
	const usedOverride = !!(override && isRenderState(override));
	let state: RenderState = usedOverride
		? (override as RenderState)
		: phaseForStatus(contest.status);

	// Embargo: gate the real lifecycle (never an explicit dev override) — scored/complete stay
	// locked until results are published, so neither leaderboard nor bracket data is even loaded.
	const published =
		!!contest.resultsPublishedAt && contest.resultsPublishedAt.getTime() <= Date.now();

	if (!usedOverride && (state === "scored" || state === "complete") && !published) {
		state = "locked";
	}

	const config = contest.config as { panel?: { id: string }[] } | null;
	const panel = config?.panel?.map((model) => model.id) ?? [];

	const meta: ContestMeta = {
		id: contest.id,
		title: CONTEST_TITLE,
		subtitle: CONTEST_SUBTITLE,
		videoId: contest.videoId,
		snapshotAt: contest.snapshotAt.toISOString(),
		capturedAt: contest.capturedAt?.toISOString() ?? null,
		fingerprint: contest.bracketFingerprint,
		panel
	};

	const data: ContestPageData = { state, contest: meta };

	if (state === "snapshotted") {
		[data.snapshot, data.entries] = await Promise.all([
			loadSnapshotStats(contest.id),
			loadEntryList(contest.id, true)
		]);
	}

	if (state === "scoring") {
		[data.scoring, data.entries] = await Promise.all([
			loadScoringStats(contest.id, panel),
			loadEntryList(contest.id, false)
		]);
	}

	if (state === "scored") data.leaderboard = await loadLeaderboard(contest.id);

	if (state === "complete") data.complete = await loadComplete(contest.id);

	return data;
};
