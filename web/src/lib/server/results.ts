// Build-time only: every page is prerendered, so this runs once during `vite build` and reads
// the committed audit bundle. The site's numbers therefore come from the public record itself.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { VIDEO_ID } from "$lib/contest.js";
import type { AuditBundle, BundleEntry, BundleMatchup } from "$lib/types/bundle";
import type {
	BracketMatchup,
	BracketRound,
	BracketVote,
	Champion,
	DisqualifiedEntry,
	RankedEntry,
	Results,
	Stats,
	Verification
} from "$lib/types/results";
import { bracketResultLabel, dqLabel, roundLabel } from "$lib/utilities/labels";

const BUNDLE_URL = `/audit/${VIDEO_ID}.json`;

// `vite build` runs with the package directory as cwd (bun run --filter).
const bundlePath = () => join(process.cwd(), "static", "audit", `${VIDEO_ID}.json`);

const commentUrl = (videoId: string, commentId: string) =>
	`https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`;

const channelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;

const normalizeText = (text: string) => text.replace(/\r\n?/g, "\n").trim();

const buildStats = (entries: BundleEntry[]): Stats => {
	const counts = new Map<string, number>();
	let eligible = 0;

	for (const entry of entries) {
		if (entry.status === "eligible") {
			eligible += 1;
		} else if (entry.dqReason) {
			counts.set(entry.dqReason, (counts.get(entry.dqReason) ?? 0) + 1);
		}
	}

	const dq = [...counts]
		.map(([reason, count]) => ({ reason, label: dqLabel(reason), count }))
		.sort((a, b) => b.count - a.count);

	return {
		captured: entries.length,
		eligible,
		disqualified: entries.length - eligible,
		seeded: entries.filter((entry) => entry.seed != null).length,
		dq
	};
};

const buildVotes = (matchup: BundleMatchup, panel: string[]): BracketVote[] =>
	panel.map((judge) => {
		const aFirst = matchup.comparisons.find((c) => c.modelId === judge && !c.orderSwapped);
		const bFirst = matchup.comparisons.find((c) => c.modelId === judge && c.orderSwapped);
		const consistent = !!aFirst && !!bFirst && aFirst.chosenEntryId === bFirst.chosenEntryId;

		if (!consistent) return { judge, pick: "split" };

		return { judge, pick: aFirst!.chosenEntryId === matchup.entryAId ? "a" : "b" };
	});

const buildRounds = (
	bundle: AuditBundle,
	byId: Map<string, BundleEntry>,
	totalRounds: number
): BracketRound[] => {
	const panel = bundle.config.panel.map((judge) => judge.id);
	const rounds = new Map<number, BracketMatchup[]>();

	for (const m of bundle.matchups) {
		const a = byId.get(m.entryAId);
		const b = byId.get(m.entryBId);

		if (!a || !b || a.seed == null || b.seed == null) continue;

		const list = rounds.get(m.round) ?? [];

		list.push({
			round: m.round,
			slot: m.slot,
			a: { id: a.id, seed: a.seed, author: a.authorDisplayName },
			b: { id: b.id, seed: b.seed, author: b.authorDisplayName },
			winner: m.winnerId === m.entryAId ? "a" : m.winnerId === m.entryBId ? "b" : null,
			votes: buildVotes(m, panel)
		});

		rounds.set(m.round, list);
	}

	return [...rounds]
		.sort(([a], [b]) => a - b)
		.map(([round, matchups]) => ({
			round,
			label: roundLabel(round, totalRounds),
			matchups: matchups.sort((x, y) => x.slot - y.slot)
		}));
};

const buildVerification = (bundle: AuditBundle, raw: Buffer): Verification => {
	const { config, result } = bundle;
	const similarity = config.similarity?.enabled ? config.similarity : null;

	return {
		panel: config.panel,
		scorePromptHash: config.prompts.score.hash,
		comparePromptHash: config.prompts.compare.hash,
		judgeSettings: Object.entries(config.judge.requestSettings ?? {}).map(([key, value]) => ({
			key,
			value: String(value)
		})),
		keywordHash: config.keywordHash,
		revealedKeywords: config.revealed?.keywords ?? null,
		revealedSalt: config.revealed?.salt ?? null,
		similarity: similarity
			? {
					hash: similarity.hash,
					embeddingModel: similarity.embeddingModel.slug,
					embeddingDimensions: similarity.embeddingDimensions,
					preprocessingVersion: similarity.preprocessingVersion,
					cosineThreshold: similarity.cosineThreshold,
					lexicalThreshold: similarity.lexicalThreshold,
					penalty:
						similarity.penalty.mode === "hard_only"
							? `−${similarity.penalty.hardPoints} points when both gates trip`
							: `${similarity.penalty.mode} (hard ${similarity.penalty.hardPoints}, soft ×${similarity.penalty.softCoefficient})`
				}
			: null,
		similarityFingerprint: result.similarityFingerprint,
		bracketFingerprint: result.bracketFingerprint,
		bundleUrl: BUNDLE_URL,
		bundleSha256: createHash("sha256").update(raw).digest("hex"),
		bundleBytes: raw.byteLength
	};
};

export const loadResults = (): Results => {
	const path = bundlePath();
	const raw = readFileSync(path);
	const bundle = JSON.parse(raw.toString("utf8")) as AuditBundle;
	const { contest, config, result } = bundle;
	const panel = config.panel.map((judge) => judge.id);
	const totalRounds = Math.max(0, ...bundle.matchups.map((m) => m.round));
	const byId = new Map(bundle.entries.map((entry) => [entry.id, entry]));

	const totalsByEntry = new Map<string, Map<string, number>>();

	for (const score of bundle.scores) {
		const totals = totalsByEntry.get(score.entryId) ?? new Map<string, number>();

		totals.set(score.modelId, score.total);
		totalsByEntry.set(score.entryId, totals);
	}

	const toRanked = (entry: BundleEntry): RankedEntry => {
		const totals = totalsByEntry.get(entry.id);
		const champion = entry.id === result.winnerEntryId;

		return {
			id: entry.id,
			rank: entry.rank!,
			seed: entry.seed,
			author: entry.authorDisplayName,
			channelUrl: channelUrl(entry.channelId),
			commentUrl: commentUrl(contest.videoId, entry.youtubeCommentId),
			submittedAt: entry.publishedAt,
			text: normalizeText(entry.text),
			score: entry.absoluteScore ?? 0,
			rawScore: entry.rawAbsoluteScore ?? entry.absoluteScore ?? 0,
			penalty: entry.originalityPenalty ?? 0,
			perJudge: panel.map((judge) => totals?.get(judge) ?? 0),
			bracket:
				entry.seed != null && entry.finalRound != null
					? {
							round: entry.finalRound,
							label: bracketResultLabel(entry.finalRound, totalRounds, champion)
						}
					: null
		};
	};

	const ranked = bundle.entries
		.filter((entry) => entry.status === "eligible" && entry.rank != null)
		.sort((a, b) => a.rank! - b.rank!)
		.map(toRanked);

	const winner = result.winnerEntryId ? byId.get(result.winnerEntryId) : undefined;
	const champion: Champion | null = winner
		? {
				...toRanked(winner),
				wins: bundle.matchups.filter((m) => m.winnerId === winner.id).length
			}
		: null;

	const disqualified: DisqualifiedEntry[] = bundle.entries
		.filter((entry) => entry.status === "disqualified")
		.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
		.map((entry) => ({
			id: entry.id,
			author: entry.authorDisplayName,
			channelUrl: channelUrl(entry.channelId),
			commentUrl: commentUrl(contest.videoId, entry.youtubeCommentId),
			submittedAt: entry.publishedAt,
			text: normalizeText(entry.text),
			reason: entry.dqReason ?? "unknown",
			label: dqLabel(entry.dqReason ?? "unknown"),
			redacted: entry.redacted
		}));

	return {
		meta: {
			videoId: contest.videoId,
			videoPublishedAt: contest.videoPublishedAt,
			snapshotAt: contest.snapshotAt,
			capturedAt: contest.capturedAt,
			resultsPublishedAt: contest.resultsPublishedAt,
			panel: config.panel
		},
		stats: buildStats(bundle.entries),
		champion,
		rounds: buildRounds(bundle, byId, totalRounds),
		ranked,
		disqualified,
		verification: buildVerification(bundle, raw)
	};
};
