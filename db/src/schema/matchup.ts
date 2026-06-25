import {
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { contest } from "./contest";
import { entry } from "./entry";

// round: 1 = round of 64, 2 = round of 32, ... 6 = final.
// slot: position of the matchup within its round (0-based).
export const matchup = pgTable(
	"matchup",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		contestId: text()
			.notNull()
			.references(() => contest.id, { onDelete: "cascade" }),
		round: integer().notNull(),
		slot: integer().notNull(),
		entryAId: text()
			.notNull()
			.references(() => entry.id),
		entryBId: text()
			.notNull()
			.references(() => entry.id),
		winnerId: text().references(() => entry.id),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		foreignKey({
			name: "matchup_contest_entry_a_fk",
			columns: [t.contestId, t.entryAId],
			foreignColumns: [entry.contestId, entry.id]
		}),
		foreignKey({
			name: "matchup_contest_entry_b_fk",
			columns: [t.contestId, t.entryBId],
			foreignColumns: [entry.contestId, entry.id]
		}),
		foreignKey({
			name: "matchup_contest_winner_fk",
			columns: [t.contestId, t.winnerId],
			foreignColumns: [entry.contestId, entry.id]
		}),
		uniqueIndex("matchup_contest_round_slot_unique").on(t.contestId, t.round, t.slot),
		index("matchup_contest_idx").on(t.contestId)
	]
);
