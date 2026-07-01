import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex
} from "drizzle-orm/pg-core";

import { newId } from "../id";
import { contest } from "./contest";
import { entry } from "./entry";

export const score = pgTable(
	"score",
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
		modelId: text().notNull(),
		persuasiveness: smallint().notNull(),
		originality: smallint().notNull(),
		cleverness: smallint().notNull(),
		execution: smallint().notNull(),
		total: smallint().notNull(),
		nonce: text().notNull(),
		audit: jsonb(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		foreignKey({
			name: "score_contest_entry_fk",
			columns: [t.contestId, t.entryId],
			foreignColumns: [entry.contestId, entry.id]
		}).onDelete("cascade"),
		uniqueIndex("score_entry_model_unique").on(t.entryId, t.modelId),
		index("score_contest_idx").on(t.contestId)
	]
);
