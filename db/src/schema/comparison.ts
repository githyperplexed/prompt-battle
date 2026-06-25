import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { entry } from "./entry";
import { matchup } from "./matchup";

// One row per model per ordering within a matchup.
// orderSwapped: false = entry A shown first, true = entry B shown first.
export const comparison = pgTable(
	"comparison",
	{
		id: text()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		matchupId: text()
			.notNull()
			.references(() => matchup.id, { onDelete: "cascade" }),
		modelId: text().notNull(),
		orderSwapped: boolean().notNull(),
		chosenEntryId: text()
			.notNull()
			.references(() => entry.id),
		audit: jsonb(),
		createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex("comparison_matchup_model_order_unique").on(t.matchupId, t.modelId, t.orderSwapped)
	]
);
