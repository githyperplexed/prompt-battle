import { createHash } from "node:crypto";

import { escapeRegExp } from "$src/utilities/text";
import type { SimilarityConfig } from "$src/utilities/contest-config";

type PenaltyConfig = SimilarityConfig["penalty"];

// Precedence = the entry's last-edit time (YouTube updatedAt; equals publishedAt when never
// edited). Ordering by publish time would let a placeholder posted early and edited late claim
// originality over the entry it copied — editing must reset an entry's place in line.
export type PreparedSimilarityEntry = {
	id: string;
	precedenceAt: Date;
	vector: Float32Array;
	shingleSet: Set<string>;
};

export type ClusterInput = {
	entries: PreparedSimilarityEntry[];
	meanOriginality: Map<string, number>;
	cosineThreshold: number;
	lexicalThreshold: number;
	penalty: PenaltyConfig;
};

export type ClusterResult = {
	entryId: string;
	clusterId: number;
	nearestEarlierEntryId: string | null;
	cosine: number;
	lexical: number;
	originalityPenalty: number;
};

export type SimilarityFingerprintEntry = {
	id: string;
	precedenceAt: Date;
	text: string;
	meanOriginality: number;
};

const alphaNumeric = String.raw`\p{L}\p{N}`;

export const normalizeForSimilarity = (text: string, keywords: string[]): string => {
	let normalized = text;
	const sorted = [...keywords]
		.map((keyword) => keyword.trim())
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);

	for (const keyword of sorted) {
		const pattern = new RegExp(
			`(^|[^${alphaNumeric}])${escapeRegExp(keyword)}(?=$|[^${alphaNumeric}])`,
			"giu"
		);
		normalized = normalized.replace(pattern, "$1");
	}

	return normalized.toLowerCase().replace(/\s+/g, " ").trim();
};

export const shingles = (text: string, k = 5): Set<string> => {
	const compact = text.replace(/\s+/g, " ").trim();

	if (compact.length === 0) return new Set();
	if (compact.length <= k) return new Set([compact]);

	const result = new Set<string>();
	for (let i = 0; i <= compact.length - k; i += 1) result.add(compact.slice(i, i + k));

	return result;
};

export const jaccard = (a: Set<string>, b: Set<string>): number => {
	if (a.size === 0 && b.size === 0) return 1;
	if (a.size === 0 || b.size === 0) return 0;

	let intersection = 0;
	const [small, large] = a.size <= b.size ? [a, b] : [b, a];

	for (const value of small) {
		if (large.has(value)) intersection += 1;
	}

	return intersection / (a.size + b.size - intersection);
};

export const cosine = (a: Float32Array, b: Float32Array): number => {
	if (a.length !== b.length) throw new Error("Vectors must have matching dimensions");

	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i += 1) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		dot += av * bv;
		normA += av * av;
		normB += bv * bv;
	}

	if (normA === 0 || normB === 0) return 0;

	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

class UnionFind {
	private parent: number[];

	constructor(size: number) {
		this.parent = Array.from({ length: size }, (_, i) => i);
	}

	find(index: number): number {
		const parent = this.parent[index];
		if (parent === undefined) throw new Error(`Missing union-find index ${index}`);
		if (parent === index) return index;

		const root = this.find(parent);
		this.parent[index] = root;

		return root;
	}

	union(a: number, b: number): void {
		const rootA = this.find(a);
		const rootB = this.find(b);
		const root = Math.min(rootA, rootB);
		this.parent[rootA] = root;
		this.parent[rootB] = root;
	}
}

const roundMetric = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

export const clusterField = (input: ClusterInput): ClusterResult[] => {
	const sorted = [...input.entries].sort((a, b) => {
		const time = a.precedenceAt.getTime() - b.precedenceAt.getTime();

		return time === 0 ? a.id.localeCompare(b.id) : time;
	});
	const union = new UnionFind(sorted.length);
	const matches = new Map<
		string,
		{
			earlierIndex: number | null;
			cosine: number;
			lexical: number;
			kind: "hard" | "soft" | null;
		}
	>();

	for (let i = 0; i < sorted.length; i += 1) {
		const current = sorted[i]!;
		let bestHard = { earlierIndex: null as number | null, cosine: 0, lexical: 0 };
		let bestSoft = { earlierIndex: null as number | null, cosine: 0, lexical: 0 };

		for (let j = 0; j < i; j += 1) {
			const earlier = sorted[j]!;
			const semantic = cosine(current.vector, earlier.vector);

			if (semantic < input.cosineThreshold) continue;

			const lexical = jaccard(current.shingleSet, earlier.shingleSet);
			const hard = lexical >= input.lexicalThreshold;
			const target = hard ? bestHard : bestSoft;
			const better =
				semantic > target.cosine ||
				(semantic === target.cosine && lexical > target.lexical) ||
				(semantic === target.cosine && lexical === target.lexical && target.earlierIndex === null);

			if (!better) continue;

			if (hard) bestHard = { earlierIndex: j, cosine: semantic, lexical };
			else bestSoft = { earlierIndex: j, cosine: semantic, lexical };
		}

		const kind =
			bestHard.earlierIndex !== null
				? "hard"
				: input.penalty.mode === "hard_and_soft" && bestSoft.earlierIndex !== null
					? "soft"
					: null;
		const best = kind === "hard" ? bestHard : kind === "soft" ? bestSoft : bestHard;

		if (kind !== null && best.earlierIndex !== null) union.union(i, best.earlierIndex);

		matches.set(current.id, { ...best, kind });
	}

	const sizeByRoot = new Map<number, number>();
	for (let i = 0; i < sorted.length; i += 1) {
		const root = union.find(i);
		sizeByRoot.set(root, (sizeByRoot.get(root) ?? 0) + 1);
	}

	const clusterIdByRoot = new Map<number, number>();
	for (let i = 0; i < sorted.length; i += 1) {
		const root = union.find(i);
		if (!clusterIdByRoot.has(root)) clusterIdByRoot.set(root, clusterIdByRoot.size + 1);
	}

	return sorted.map((entry, i) => {
		const match = matches.get(entry.id)!;
		const clusterSize = sizeByRoot.get(union.find(i)) ?? 1;
		const meanOriginality = input.meanOriginality.get(entry.id) ?? 0;
		const soft =
			match.kind !== null && input.penalty.mode === "hard_and_soft"
				? input.penalty.softCoefficient * Math.log(clusterSize)
				: 0;
		const rawPenalty =
			match.kind === "hard" ? input.penalty.hardPoints + soft : match.kind === "soft" ? soft : 0;
		const penalty = Math.min(rawPenalty, meanOriginality);

		return {
			entryId: entry.id,
			clusterId: clusterIdByRoot.get(union.find(i))!,
			nearestEarlierEntryId:
				match.kind !== null && match.earlierIndex !== null
					? (sorted[match.earlierIndex]?.id ?? null)
					: null,
			cosine: roundMetric(match.cosine),
			lexical: roundMetric(match.lexical),
			originalityPenalty: roundMetric(penalty)
		};
	});
};

export const similarityInputFingerprint = (
	configHash: string,
	entries: SimilarityFingerprintEntry[]
): string => {
	const payload = entries
		.map((entry) => ({
			id: entry.id,
			precedenceAt: entry.precedenceAt.toISOString(),
			text: entry.text,
			meanOriginality: Math.round(entry.meanOriginality * 1_000_000) / 1_000_000
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	return createHash("sha256")
		.update(configHash)
		.update("\0")
		.update(JSON.stringify(payload))
		.digest("hex");
};
