import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "@prompt-battle/db";

import {
	auditBundleHash,
	buildAuditBundle,
	serializeAuditBundle
} from "$src/utilities/audit-bundle";
import { parseContestConfig } from "$src/utilities/contest-config";

// The bundle ships as a static asset of the web app: committing the generated file is what
// deploys it, and the commit doubles as the public timestamp anchoring the record.
const defaultOutPath = (videoId: string): string =>
	fileURLToPath(new URL(`../../../web/static/audit/${videoId}.json`, import.meta.url));

export type ExportReport = {
	skipped: false;
	path: string;
	hash: string;
	entries: number;
	scores: number;
	similarities: number;
	matchups: number;
	comparisons: number;
};

export const exportContest = async (
	contestId: string,
	options: { out?: string } = {}
): Promise<ExportReport | { skipped: true; reason: string }> => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId)
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	// The bundle contains everything publish embargoes (keywords, salt, bracket, winner), so it
	// follows the exact same time gate — a scheduled future publish stays unexportable.
	const published =
		!!target.resultsPublishedAt && target.resultsPublishedAt.getTime() <= Date.now();

	if (!published) return { skipped: true as const, reason: "results are not published" };

	const config = parseContestConfig(target.config);

	if (!config.revealed) {
		throw new Error(
			"Contest is published but its config has no revealed keywords — refusing to export an incomplete record"
		);
	}

	const entries = await db.query.entry.findMany({
		where: (e, { eq }) => eq(e.contestId, contestId)
	});
	const scores = await db.query.score.findMany({
		where: (s, { eq }) => eq(s.contestId, contestId)
	});
	const similarities = await db.query.similarity.findMany({
		where: (s, { eq }) => eq(s.contestId, contestId)
	});
	const matchups = await db.query.matchup.findMany({
		where: (m, { eq }) => eq(m.contestId, contestId)
	});
	const matchupIds = matchups.map((matchup) => matchup.id);
	const comparisons = matchupIds.length
		? await db.query.comparison.findMany({
				where: (c, { inArray }) => inArray(c.matchupId, matchupIds)
			})
		: [];

	const bundle = buildAuditBundle({
		contest: target,
		config,
		entries,
		scores,
		similarities,
		matchups,
		comparisons
	});
	const serialized = serializeAuditBundle(bundle);
	const path = options.out ? resolve(options.out) : defaultOutPath(target.videoId);

	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, serialized);

	return {
		skipped: false as const,
		path,
		hash: auditBundleHash(serialized),
		entries: entries.length,
		scores: scores.length,
		similarities: similarities.length,
		matchups: matchups.length,
		comparisons: comparisons.length
	};
};
