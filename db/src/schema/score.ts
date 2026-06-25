import { index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { contest } from "./contest";
import { entry } from "./entry";

export const score = pgTable(
	"score",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => nanoid()),
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
		uniqueIndex("score_entry_model_unique").on(t.entryId, t.modelId),
		index("score_contest_idx").on(t.contestId)
	]
);
