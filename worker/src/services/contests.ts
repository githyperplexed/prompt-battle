import { contest, db } from "@prompt-battle/db";

type CreateContestInput = {
	videoId: string;
	videoPublishedAt: Date;
	snapshotAt: Date;
	config: Record<string, unknown>;
};

export const createContest = async (input: CreateContestInput) => {
	const existing = await db.query.contest.findFirst({
		where: (c, { eq }) => eq(c.videoId, input.videoId),
		columns: { id: true }
	});

	if (existing) {
		throw new Error(`A contest already exists for video ${input.videoId} (id ${existing.id})`);
	}

	const [row] = await db
		.insert(contest)
		.values({
			videoId: input.videoId,
			videoPublishedAt: input.videoPublishedAt,
			snapshotAt: input.snapshotAt,
			status: "open",
			config: input.config
		})
		.returning();

	if (!row) throw new Error("Failed to create contest");

	return row;
};
