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
import {
	isPhase,
	PHASES,
	phaseForStatus,
	stepIndexFor,
	type Phase,
	type RenderState
} from "$lib/utilities/phases";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }): Promise<ContestPageData> => {
	const contest = await loadActiveContest();

	if (!contest) return { state: "not_found", contest: null };

	const config = contest.config as { panel?: { id: string }[] } | null;
	const panel = config?.panel?.map((model) => model.id) ?? [];

	const meta: ContestMeta = {
		id: contest.id,
		title: CONTEST_TITLE,
		subtitle: CONTEST_SUBTITLE,
		videoId: contest.videoId,
		videoPublishedAt: contest.videoPublishedAt.toISOString(),
		snapshotAt: contest.snapshotAt.toISOString(),
		capturedAt: contest.capturedAt?.toISOString() ?? null,
		fingerprint: contest.bracketFingerprint,
		panel
	};

	// An unknown status has no lifecycle phase, so it renders as a bare draft notice (no stepper).
	const statusPhase = phaseForStatus(contest.status);
	if (!isPhase(statusPhase)) return { state: "draft", contest: meta };

	const published =
		!!contest.resultsPublishedAt && contest.resultsPublishedAt.getTime() <= Date.now();

	// Embargo-corrected real progress — only the bracket (`complete`) waits for publish; the ranked
	// leaderboard (`scored`) is public the moment scoring finishes. So an unpublished `complete`
	// contest still surfaces `scored` as its furthest public phase. Drives the stepper's completed-
	// phase checkmarks and the default landing phase.
	let progress: RenderState = statusPhase;
	if (progress === "complete" && !published) progress = "scored";

	// The viewed step is public: anyone can navigate to any phase via ?phase=. It only selects which
	// view to render — it never unlocks data. Defaults to the embargo-corrected current phase.
	const requested = url.searchParams.get("phase");
	const view: Phase = requested && isPhase(requested) ? requested : PHASES[stepIndexFor(progress)]!;

	// Reveal gate — enforced server-side so embargoed or not-yet-reached data never leaves the server.
	// A phase's real data is returned only once the contest has actually reached it; the bracket
	// (`complete`) additionally waits for publish, while the leaderboard (`scored`) does not. The
	// dev-only ?peek=true bypasses the gate.
	const peek = dev && url.searchParams.get("peek") === "true";
	const reachedIndex = stepIndexFor(statusPhase);
	const viewIndex = stepIndexFor(view);

	let state: RenderState;
	if (peek) state = view;
	else if (viewIndex > reachedIndex) state = "upcoming";
	else if (view === "complete" && !published) state = "locked";
	else state = view;

	const data: ContestPageData = { state, view, progress, contest: meta };

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

	if (state === "scored") data.leaderboard = await loadLeaderboard(contest.id, panel);

	if (state === "complete") data.complete = await loadComplete(contest.id);

	return data;
};
