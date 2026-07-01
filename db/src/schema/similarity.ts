import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex
} from "drizzle-orm/pg-core";

import { newId } from "../id";
import { contest } from "./contest";
import { entry } from "./entry";

export const similarity = pgTable(
	"similarity",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => newId()),
		contestId: text()
			.notNull()
			.references(() => contest.id, { onDelete: "cascade" }),
		entryId: text()
			.notNull()
			.references(() => entry.id, { onDelete: "cascade" }),
		clusterId: integer().notNull(),
		nearestEarlierEntryId: text().references(() => entry.id, { onDelete: "set null" }),
		cosine: real().notNull(),
		lexical: real().notNull(),
		originalityPenalty: real().notNull().default(0),
		configHash: text().notNull(),
		fieldFingerprint: text().notNull(),
		embeddingModel: text().notNull(),
		preprocessingVersion: integer().notNull(),
		embedding: text(),
		audit: jsonb(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		foreignKey({
			name: "similarity_contest_entry_fk",
			columns: [t.contestId, t.entryId],
			foreignColumns: [entry.contestId, entry.id]
		}).onDelete("cascade"),
		uniqueIndex("similarity_entry_unique").on(t.entryId),
		index("similarity_contest_idx").on(t.contestId),
		index("similarity_fingerprint_idx").on(t.contestId, t.fieldFingerprint)
	]
);
