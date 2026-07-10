import { BRACKET_SIZE, MAX_ENTRIES } from "$src/constants";
import type { AuditBundle } from "$src/utilities/audit-bundle";
import { bracketFingerprint, nextPowerOfTwo, seedOrder } from "$src/utilities/bracket";
import { parseContestConfig, type ContestConfig } from "$src/utilities/contest-config";
import { hasAllKeywords, matchesKeywordHash } from "$src/utilities/keywords";
import { aggregateTotals, rankEntries } from "$src/utilities/ranking";
import { similarityInputFingerprint } from "$src/utilities/similarity";
import { classifyComment, countCharacters } from "$src/utilities/validation";

export type CheckResult = {
	id: number;
	title: string;
	pass: boolean;
	// Human-readable outcome; on failure, the first thing that broke.
	detail: string;
	// Disclosed-but-not-recomputable facts (judgment-call DQs, missing optional data).
	notes: string[];
};

export type VerifyReport = { pass: boolean; checks: CheckResult[] };

// Stored numeric columns are float32 (`real`), so recomputed float64 values can differ in the
// 7th significant digit. Comparisons against stored values use this tolerance; fingerprints are
// compared exactly because both sides derive from the same float64 arithmetic.
const TOLERANCE = 1e-4;

const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCE;

const MECHANICAL_REASONS = new Set(["too_short", "too_long", "has_url", "missing_keywords"]);
const JUDGMENT_REASONS = new Set(["tos", "affiliated", "deleted", "unscorable"]);

type Entry = AuditBundle["entries"][number];

const check = (id: number, title: string, notes: string[], run: () => string): CheckResult => {
	try {
		return { id, title, pass: true, detail: run(), notes };
	} catch (error) {
		return { id, title, pass: false, detail: (error as Error).message, notes };
	}
};

const fail = (message: string): never => {
	throw new Error(message);
};

const checkConfigIntegrity = (bundle: AuditBundle): CheckResult =>
	check(1, "Config integrity (prompts, panel, similarity)", [], () => {
		// parseContestConfig re-derives every embedded hash from the embedded content and throws
		// on any mismatch — the same fail-closed validation the engine runs on every parse.
		const config = parseContestConfig(bundle.config);

		return `config self-validates; panel [${config.panel.map((m) => m.id).join(", ")}]`;
	});

const checkKeywordCommitment = (config: ContestConfig): CheckResult =>
	check(2, "Keyword commitment", [], () => {
		const revealed = config.revealed ?? fail("bundle config has no revealed keywords");

		if (!matchesKeywordHash(revealed.keywords, revealed.salt, config.keywordHash)) {
			fail("revealed keywords + salt do not re-derive the committed keyword hash");
		}

		return `keywords [${revealed.keywords.join(", ")}] re-derive ${config.keywordHash.slice(0, 10)}…`;
	});

const checkEligibility = (bundle: AuditBundle, config: ContestConfig): CheckResult => {
	const notes: string[] = [];

	return check(3, "Eligibility of the captured field", notes, () => {
		const keywords = config.revealed?.keywords ?? fail("no revealed keywords to validate against");
		const snapshotAt = new Date(bundle.contest.snapshotAt).getTime();
		const judgmentCounts = new Map<string, number>();

		for (const entry of bundle.entries) {
			const label = `entry ${entry.id}`;

			if (entry.status === "eligible") {
				if (new Date(entry.updatedAt).getTime() > snapshotAt) {
					fail(`${label} is eligible but was edited after the cutoff`);
				}

				if (countCharacters(entry.text) !== entry.charCount) {
					fail(
						`${label} charCount ${entry.charCount} != recomputed ${countCharacters(entry.text)}`
					);
				}

				const verdict = classifyComment(entry, { keywords, excluded: new Set() });

				if (!verdict.eligible) {
					fail(`${label} is eligible but re-classifies as ${verdict.reason}`);
				}

				continue;
			}

			const reason = entry.dqReason ?? "deleted";

			if (MECHANICAL_REASONS.has(reason)) {
				const verdict = classifyComment(entry, { keywords, excluded: new Set() });

				if (verdict.eligible || verdict.reason !== reason) {
					fail(
						`${label} recorded ${reason} but re-classifies as ${verdict.eligible ? "eligible" : verdict.reason}`
					);
				}
			} else if (reason === "edited_after_cutoff") {
				if (new Date(entry.updatedAt).getTime() <= snapshotAt) {
					fail(`${label} recorded edited_after_cutoff but its last edit precedes the cutoff`);
				}
			} else if (reason === "duplicate_channel") {
				const earlier = bundle.entries.some(
					(other) =>
						other.id !== entry.id &&
						other.channelId === entry.channelId &&
						new Date(other.publishedAt).getTime() <= new Date(entry.publishedAt).getTime()
				);

				if (!earlier)
					fail(`${label} recorded duplicate_channel with no earlier same-channel entry`);
			} else if (JUDGMENT_REASONS.has(reason)) {
				judgmentCounts.set(reason, (judgmentCounts.get(reason) ?? 0) + 1);
			} else if (reason !== "over_cap") {
				fail(`${label} has unknown dq reason ${reason}`);
			}
		}

		const eligible = bundle.entries.filter((e) => e.status === "eligible");
		const channels = new Set(eligible.map((e) => e.channelId));

		if (channels.size !== eligible.length) fail("a channel has more than one eligible entry");
		if (eligible.length > MAX_ENTRIES) fail(`eligible count exceeds the ${MAX_ENTRIES} cap`);

		if (!eligible.every((e) => hasAllKeywords(e.text, keywords))) {
			fail("an eligible entry is missing a required keyword");
		}

		for (const [reason, count] of [...judgmentCounts].sort()) {
			notes.push(
				`${count} ${reason} disqualification(s) are judgment calls — disclosed (see dqNote/dqEvidence), not recomputable`
			);
		}

		return `${bundle.entries.length} entries re-validated (${eligible.length} eligible)`;
	});
};

// Recomputes each eligible entry's aggregate exactly as `advance` does: rounded mean of the
// model totals, minus the recorded penalty (exact, no re-round), ranked with the §7.6 tie-breaks.
const recomputeRanking = (bundle: AuditBundle, config: ContestConfig) => {
	const eligible = bundle.entries.filter((e) => e.status === "eligible");
	const totalsByEntry = new Map<string, number[]>();
	const originalityByEntry = new Map<string, number[]>();

	for (const score of bundle.scores) {
		totalsByEntry.set(score.entryId, [...(totalsByEntry.get(score.entryId) ?? []), score.total]);
		originalityByEntry.set(score.entryId, [
			...(originalityByEntry.get(score.entryId) ?? []),
			score.originality
		]);
	}

	const penaltyByEntry = new Map(bundle.similarities.map((s) => [s.entryId, s.originalityPenalty]));
	const meanOriginality = new Map(
		[...originalityByEntry].map(([entryId, values]) => [
			entryId,
			values.reduce((sum, value) => sum + value, 0) / values.length
		])
	);

	const rankable = eligible.map((entry) => {
		const totals = totalsByEntry.get(entry.id) ?? [];

		if (totals.length !== config.panel.length) {
			fail(`entry ${entry.id} has ${totals.length}/${config.panel.length} model scores`);
		}

		const aggregate = aggregateTotals(totals);
		const penalty = penaltyByEntry.get(entry.id) ?? 0;

		return {
			id: entry.id,
			precedenceAt: new Date(entry.updatedAt),
			...aggregate,
			rawAbsoluteScore: aggregate.absoluteScore,
			penalty,
			absoluteScore: aggregate.absoluteScore - penalty
		};
	});

	const ranked = rankEntries(rankable).map((e, i) => ({ ...e, rank: i + 1 }));
	const seeded = ranked
		.slice(0, BRACKET_SIZE)
		.map((e) => ({ id: e.id, rank: e.rank, seed: e.rank, absoluteScore: e.absoluteScore }));

	return { ranked, seeded, meanOriginality };
};

const checkScoresAndSeeding = (
	bundle: AuditBundle,
	config: ContestConfig,
	ranked: ReturnType<typeof recomputeRanking>["ranked"],
	seeded: ReturnType<typeof recomputeRanking>["seeded"]
): CheckResult =>
	check(4, "Scores, ranking, and the seeded-field fingerprint", [], () => {
		const modelIds = new Set(config.panel.map((m) => m.id));
		const eligibleIds = new Set(
			bundle.entries.filter((e) => e.status === "eligible").map((e) => e.id)
		);

		for (const score of bundle.scores) {
			const dims = [score.persuasiveness, score.originality, score.cleverness, score.execution];

			if (!modelIds.has(score.modelId)) fail(`score by unknown model ${score.modelId}`);
			if (dims.some((d) => !Number.isInteger(d) || d < 0 || d > 25)) {
				fail(`score for ${score.entryId} by ${score.modelId} has an out-of-range dimension`);
			}
			if (dims.reduce((sum, d) => sum + d, 0) !== score.total) {
				fail(`score for ${score.entryId} by ${score.modelId}: dimensions do not sum to total`);
			}
		}

		const byEntry = new Map(bundle.entries.map((e) => [e.id, e]));

		for (const r of ranked) {
			const entry = byEntry.get(r.id) ?? fail(`ranked entry ${r.id} missing from bundle`);

			if (entry.rank !== r.rank) fail(`entry ${r.id} stored rank ${entry.rank} != ${r.rank}`);
			if (entry.seed !== (r.rank <= BRACKET_SIZE ? r.rank : null)) {
				fail(`entry ${r.id} stored seed ${entry.seed} disagrees with recomputed rank`);
			}
			if (entry.absoluteScore === null || !near(entry.absoluteScore, r.absoluteScore)) {
				fail(`entry ${r.id} stored absoluteScore ${entry.absoluteScore} != ${r.absoluteScore}`);
			}
		}

		if (eligibleIds.size !== ranked.length)
			fail("ranked field does not cover all eligible entries");

		const fingerprint = bracketFingerprint(seeded);

		if (fingerprint !== bundle.result.bracketFingerprint) {
			fail(
				`recomputed fingerprint ${fingerprint.slice(0, 16)}… != published ${String(bundle.result.bracketFingerprint).slice(0, 16)}…`
			);
		}

		return `${ranked.length} entries re-ranked; fingerprint ${fingerprint.slice(0, 16)}… matches`;
	});

const checkPenalties = (
	bundle: AuditBundle,
	config: ContestConfig,
	meanOriginality: Map<string, number>
): CheckResult => {
	const notes: string[] = [
		"pairwise similarity values cannot be recomputed without the embedding vectors; this check confirms the recorded values imply the recorded penalties under the committed config"
	];

	return check(5, "Near-duplicate originality penalties", notes, () => {
		const similarity = config.similarity;
		const eligible = bundle.entries.filter((e) => e.status === "eligible");
		const rows = new Map(bundle.similarities.map((s) => [s.entryId, s]));
		const byEntry = new Map(bundle.entries.map((e) => [e.id, e]));

		if (!similarity.enabled) return "similarity pass disabled for this contest";
		if (rows.size !== eligible.length) {
			fail(`similarity coverage ${rows.size}/${eligible.length} eligible entries`);
		}

		const fingerprint = similarityInputFingerprint(
			similarity.hash,
			eligible.map((e) => ({
				id: e.id,
				precedenceAt: new Date(e.updatedAt),
				text: e.text,
				meanOriginality: meanOriginality.get(e.id) ?? 0
			}))
		);

		if (fingerprint !== bundle.result.similarityFingerprint) {
			fail("recomputed similarity-input fingerprint does not match the published one");
		}

		const clusterSizes = new Map<number, number>();

		for (const row of bundle.similarities) {
			clusterSizes.set(row.clusterId, (clusterSizes.get(row.clusterId) ?? 0) + 1);
		}

		let penalized = 0;

		for (const row of bundle.similarities) {
			const label = `similarity row for ${row.entryId}`;

			if (row.configHash !== similarity.hash) fail(`${label} pins a different config hash`);
			if (row.fieldFingerprint !== fingerprint) fail(`${label} pins a different field fingerprint`);

			if (row.nearestEarlierEntryId === null) {
				if (row.originalityPenalty !== 0) fail(`${label} has a penalty but no earlier match`);
				continue;
			}

			const match = rows.get(row.nearestEarlierEntryId) ?? fail(`${label} matches a non-entry`);
			const self = byEntry.get(row.entryId)!;
			const other = byEntry.get(match.entryId)!;

			if (match.clusterId !== row.clusterId) fail(`${label} matches outside its cluster`);

			const ownTime = new Date(self.updatedAt).getTime();
			const otherTime = new Date(other.updatedAt).getTime();

			if (otherTime > ownTime || (otherTime === ownTime && other.id >= self.id)) {
				fail(`${label} matches an entry that does not precede it`);
			}

			if (row.cosine < similarity.cosineThreshold - TOLERANCE) {
				fail(`${label} penalized below the cosine threshold`);
			}

			const hard = row.lexical >= similarity.lexicalThreshold - TOLERANCE;

			if (similarity.penalty.mode === "hard_only" && !hard) {
				fail(`${label} penalized below the lexical threshold in hard_only mode`);
			}

			const size = clusterSizes.get(row.clusterId) ?? 1;
			const soft =
				similarity.penalty.mode === "hard_and_soft"
					? similarity.penalty.softCoefficient * Math.log(size)
					: 0;
			const raw = (hard ? similarity.penalty.hardPoints : 0) + soft;
			const expected = Math.min(raw, meanOriginality.get(row.entryId) ?? 0);

			if (!near(row.originalityPenalty, expected)) {
				fail(`${label} penalty ${row.originalityPenalty} != expected ${expected}`);
			}

			if (row.originalityPenalty > 0) penalized += 1;
		}

		return `${bundle.similarities.length} rows verified (${penalized} penalized); input fingerprint matches`;
	});
};

const checkBracketReplay = (
	bundle: AuditBundle,
	config: ContestConfig,
	seeded: { id: string }[]
): CheckResult =>
	check(6, "Bracket replay from the recorded votes", [], () => {
		const modelIds = new Set(config.panel.map((m) => m.id));
		const seedOfId = new Map(seeded.map((s, i) => [s.id, i + 1]));
		const idBySeed = new Map(seeded.map((s, i) => [i + 1, s.id]));
		const stored = new Map(bundle.matchups.map((m) => [`${m.round}:${m.slot}`, m]));
		let consumed = 0;

		let slots: (string | null)[] = seedOrder(nextPowerOfTwo(seeded.length)).map(
			(seed) => idBySeed.get(seed) ?? null
		);
		let round = 1;

		while (slots.length > 1) {
			const winners: (string | null)[] = [];

			for (let i = 0; i < slots.length; i += 2) {
				const slot = i / 2;
				const [a, b] = [slots[i] ?? null, slots[i + 1] ?? null];
				const key = `${round}:${slot}`;
				const matchup = stored.get(key);

				// A bye auto-advances with no stored row.
				if (!a || !b) {
					if (matchup) fail(`matchup r${round} s${slot} exists for a bye`);
					winners.push(a ?? b);
					continue;
				}

				if (!matchup) fail(`matchup r${round} s${slot} is missing`);
				consumed += 1;

				const [entryA, entryB] = seedOfId.get(a)! <= seedOfId.get(b)! ? [a, b] : [b, a];

				if (matchup!.entryAId !== entryA || matchup!.entryBId !== entryB) {
					fail(`matchup r${round} s${slot} pairs the wrong entries for these seeds`);
				}

				const byModel = new Map<string, Set<string>>();

				for (const c of matchup!.comparisons) {
					if (!modelIds.has(c.modelId)) fail(`matchup r${round} s${slot}: unknown model vote`);
					if (c.chosenEntryId !== entryA && c.chosenEntryId !== entryB) {
						fail(`matchup r${round} s${slot}: a vote chose a non-participant`);
					}

					byModel.set(c.modelId, (byModel.get(c.modelId) ?? new Set()).add(c.chosenEntryId));
				}

				// §7.5 both-ways rule: a model's vote counts only when both orderings exist and agree.
				// A model with a missing ordering abstained (its refusal is the absent row).
				let aVotes = 0;
				let bVotes = 0;

				for (const [modelId, choices] of byModel) {
					const orderings = matchup!.comparisons.filter((c) => c.modelId === modelId);

					if (orderings.length !== 2 || choices.size !== 1) continue;
					if (choices.has(entryA)) aVotes += 1;
					else bVotes += 1;
				}

				const winner = bVotes > aVotes ? entryB : entryA;

				if (matchup!.winnerId !== winner) {
					fail(
						`matchup r${round} s${slot}: recorded winner ${matchup!.winnerId} != replayed ${winner}`
					);
				}

				winners.push(winner);
			}

			slots = winners;
			round += 1;
		}

		if (consumed !== bundle.matchups.length) {
			fail(
				`${bundle.matchups.length - consumed} stored matchup(s) not part of the replayed bracket`
			);
		}

		const champion = slots[0] ?? fail("replay produced no champion");

		if (champion !== bundle.result.winnerEntryId) {
			fail(`replayed champion ${champion} != published winner ${bundle.result.winnerEntryId}`);
		}

		return `${consumed} matchups replayed over ${round - 1} rounds; champion ${champion} confirmed`;
	});

export const verifyAuditBundle = (raw: unknown): VerifyReport => {
	const bundle = raw as AuditBundle;

	if (!bundle || typeof bundle !== "object" || bundle.formatVersion !== 1) {
		return {
			pass: false,
			checks: [
				{
					id: 0,
					title: "Bundle format",
					pass: false,
					detail: "not a formatVersion 1 audit bundle",
					notes: []
				}
			]
		};
	}

	const checks: CheckResult[] = [checkConfigIntegrity(bundle)];

	// Everything downstream trusts the config's self-validated hashes; without them the
	// remaining checks would verify against unpinned values, so stop here.
	if (!checks[0]!.pass) return { pass: false, checks };

	const config = parseContestConfig(bundle.config);

	checks.push(checkKeywordCommitment(config));
	checks.push(checkEligibility(bundle, config));

	try {
		const { ranked, seeded, meanOriginality } = recomputeRanking(bundle, config);

		checks.push(checkScoresAndSeeding(bundle, config, ranked, seeded));
		checks.push(checkPenalties(bundle, config, meanOriginality));
		checks.push(checkBracketReplay(bundle, config, seeded));
	} catch (error) {
		checks.push({
			id: 4,
			title: "Scores, ranking, and the seeded-field fingerprint",
			pass: false,
			detail: (error as Error).message,
			notes: []
		});
	}

	return { pass: checks.every((c) => c.pass), checks };
};
