import { and, contest, db, entry, eq, score, similarity } from "@prompt-battle/db";

import { embedEntries } from "$src/services/embeddings";
import { withContestLock } from "$src/services/locks";
import { loadKeywordSecret } from "$src/services/secrets";
import { parseContestConfig } from "$src/utilities/contest-config";
import { matchesKeywordHash } from "$src/utilities/keywords";
import {
	clusterField,
	normalizeForSimilarity,
	shingles,
	similarityInputFingerprint,
	type ClusterResult
} from "$src/utilities/similarity";

const INSERT_CHUNK = 500;

type EligibleEntry = { id: string; text: string; updatedAt: Date };

type SimilarityReport = {
	skipped: false;
	entries: number;
	penalized: number;
	largestCluster: number;
	clusters: number;
	fingerprint: string;
};

const loadContest = async (contestId: string) => {
	const target = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.id, contestId),
		columns: { id: true, videoId: true, status: true, config: true }
	});

	if (!target) throw new Error(`No contest with id ${contestId}`);

	return { ...target, config: parseContestConfig(target.config) };
};

const loadEligibleEntries = (contestId: string): Promise<EligibleEntry[]> =>
	db.query.entry.findMany({
		where: (e, { and, eq }) => and(eq(e.contestId, contestId), eq(e.status, "eligible")),
		columns: { id: true, text: true, updatedAt: true }
	});

const loadMeanOriginality = async (
	contestId: string,
	entries: EligibleEntry[],
	expectedModels: number
): Promise<Map<string, number>> => {
	const rows = await db
		.select({ entryId: score.entryId, originality: score.originality })
		.from(score)
		.where(eq(score.contestId, contestId));
	const byEntry = new Map<string, number[]>();

	for (const row of rows) {
		const list = byEntry.get(row.entryId) ?? [];
		list.push(row.originality);
		byEntry.set(row.entryId, list);
	}

	const means = new Map<string, number>();
	const missing = entries.filter(
		(entry) => (byEntry.get(entry.id)?.length ?? 0) !== expectedModels
	);

	if (missing.length > 0) {
		throw new Error(`Contest ${contestId} has ${missing.length} entry originality set(s) missing`);
	}

	for (const [entryId, values] of byEntry) {
		means.set(entryId, values.reduce((sum, value) => sum + value, 0) / values.length);
	}

	return means;
};

const clusterReport = (results: ClusterResult[], fingerprint: string): SimilarityReport => {
	const clusterSizes = new Map<number, number>();
	for (const result of results) {
		clusterSizes.set(result.clusterId, (clusterSizes.get(result.clusterId) ?? 0) + 1);
	}

	return {
		skipped: false,
		entries: results.length,
		penalized: results.filter((result) => result.originalityPenalty > 0).length,
		largestCluster: Math.max(0, ...clusterSizes.values()),
		clusters: clusterSizes.size,
		fingerprint
	};
};

export const clusterContest = async (
	contestId: string,
	options: { storeVectors?: boolean } = {}
): Promise<SimilarityReport | { skipped: true; status?: string; reason?: string }> =>
	withContestLock(contestId, async () => {
		const target = await loadContest(contestId);

		if (target.status !== "scored") return { skipped: true as const, status: target.status };
		if (!target.config.similarity.enabled) return { skipped: true as const, reason: "disabled" };

		const secret = loadKeywordSecret(target.videoId);
		if (!matchesKeywordHash(secret.keywords, secret.salt, target.config.keywordHash)) {
			throw new Error(`secrets/${target.videoId}.json does not match contest keyword hash`);
		}

		const entries = await loadEligibleEntries(contestId);
		const meanOriginality = await loadMeanOriginality(
			contestId,
			entries,
			target.config.panel.length
		);
		const normalized = entries.map((entry) => ({
			...entry,
			text: normalizeForSimilarity(entry.text, secret.keywords)
		}));
		const fingerprint = similarityInputFingerprint(
			target.config.similarity.hash,
			entries.map((entry) => ({
				id: entry.id,
				precedenceAt: entry.updatedAt,
				text: entry.text,
				meanOriginality: meanOriginality.get(entry.id) ?? 0
			}))
		);
		const embedded = await embedEntries(
			normalized.map((entry) => ({ id: entry.id, text: entry.text || " " })),
			target.config.similarity,
			{ storeVectors: options.storeVectors ?? false }
		);

		if (embedded.size !== entries.length) {
			throw new Error(`Embedding coverage incomplete: ${embedded.size} / ${entries.length}`);
		}

		const prepared = normalized.map((entry) => {
			const item = embedded.get(entry.id);
			if (!item) throw new Error(`Missing embedding for entry ${entry.id}`);

			return {
				id: entry.id,
				precedenceAt: entry.updatedAt,
				vector: item.vector,
				shingleSet: shingles(entry.text)
			};
		});
		const results = clusterField({
			entries: prepared,
			meanOriginality,
			cosineThreshold: target.config.similarity.cosineThreshold,
			lexicalThreshold: target.config.similarity.lexicalThreshold,
			penalty: target.config.similarity.penalty
		});
		const auditByEntry = embedded;

		await db.transaction(async (tx) => {
			await tx.delete(similarity).where(eq(similarity.contestId, contestId));

			for (let i = 0; i < results.length; i += INSERT_CHUNK) {
				const chunk = results.slice(i, i + INSERT_CHUNK).map((result) => {
					const audit = auditByEntry.get(result.entryId);

					return {
						contestId,
						entryId: result.entryId,
						clusterId: result.clusterId,
						nearestEarlierEntryId: result.nearestEarlierEntryId,
						cosine: result.cosine,
						lexical: result.lexical,
						originalityPenalty: result.originalityPenalty,
						configHash: target.config.similarity.hash,
						fieldFingerprint: fingerprint,
						embeddingModel: target.config.similarity.embeddingModel.slug,
						preprocessingVersion: target.config.similarity.preprocessingVersion,
						embedding: audit?.embedding,
						audit: audit?.audit
					};
				});

				if (chunk.length > 0) await tx.insert(similarity).values(chunk);
			}

			await tx
				.update(entry)
				.set({ originalityPenalty: null })
				.where(and(eq(entry.contestId, contestId), eq(entry.status, "eligible")));
			await tx
				.update(contest)
				.set({ similarityComputedAt: new Date(), similarityFingerprint: fingerprint })
				.where(eq(contest.id, contestId));
		});

		return clusterReport(results, fingerprint);
	});
