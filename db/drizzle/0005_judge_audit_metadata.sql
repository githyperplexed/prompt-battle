ALTER TABLE "score" RENAME COLUMN "usage" TO "audit";--> statement-breakpoint
ALTER TABLE "comparison" ADD COLUMN "audit" jsonb;
