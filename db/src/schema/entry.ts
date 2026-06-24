import {
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { contest } from "./contest";

export const entryStatus = pgEnum("entry_status", ["eligible", "disqualified"]);

export const dqReason = pgEnum("dq_reason", [
	"missing_keywords",
	"too_short",
	"too_long",
	"has_url",
	"duplicate_channel",
	"affiliated",
	"tos",
	"deleted"
]);

export const entry = pgTable(
	"entry",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		contestId: text()
			.notNull()
			.references(() => contest.id, { onDelete: "cascade" }),
		youtubeCommentId: text().notNull(),
		channelId: text().notNull(),
		authorDisplayName: text().notNull(),
		text: text().notNull(),
		charCount: integer().notNull(),
		publishedAt: timestamp({ withTimezone: true }).notNull(),
		updatedAt: timestamp({ withTimezone: true }).notNull(),
		status: entryStatus().notNull().default("eligible"),
		dqReason: dqReason(),
		absoluteScore: real(),
		rank: integer(),
		seed: integer(),
		finalRound: integer(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex("entry_contest_comment_unique").on(t.contestId, t.youtubeCommentId),
		index("entry_contest_channel_idx").on(t.contestId, t.channelId),
		index("entry_contest_status_idx").on(t.contestId, t.status)
	]
);
