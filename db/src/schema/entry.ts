import {
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	unique,
	uniqueIndex
} from "drizzle-orm/pg-core";

import { newId } from "../id";
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
	"edited_after_cutoff",
	"over_cap",
	"deleted"
]);

export const entry = pgTable(
	"entry",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => newId()),
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
		// Operator justification for a manual disqualification (the `dq` command). Null for
		// automated/ingest-time DQs, so a non-null note marks a hand-issued, human-judged removal.
		dqNote: text(),
		absoluteScore: real(),
		rawAbsoluteScore: real(),
		originalityPenalty: real(),
		rank: integer(),
		seed: integer(),
		finalRound: integer(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		unique("entry_contest_id_unique").on(t.contestId, t.id),
		uniqueIndex("entry_contest_comment_unique").on(t.contestId, t.youtubeCommentId),
		index("entry_contest_channel_idx").on(t.contestId, t.channelId),
		index("entry_contest_status_idx").on(t.contestId, t.status)
	]
);
