import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const contestStatus = pgEnum("contest_status", [
	"draft",
	"open",
	"snapshotted",
	"scoring",
	"scored",
	"complete"
]);

export const contest = pgTable("contest", {
	id: text()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	videoId: text().notNull(),
	videoPublishedAt: timestamp({ withTimezone: true }).notNull(),
	snapshotAt: timestamp({ withTimezone: true }).notNull(),
	capturedAt: timestamp({ withTimezone: true }),
	status: contestStatus().notNull().default("draft"),
	config: jsonb(),
	winnerEntryId: text(),
	bracketFingerprint: text(),
	resultsPublishedAt: timestamp({ withTimezone: true }),
	createdAt: timestamp({ withTimezone: true }).defaultNow().notNull()
});
