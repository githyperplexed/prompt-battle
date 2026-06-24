ALTER TABLE "contest" ADD COLUMN "winner_entry_id" text;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "absolute_score" real;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "rank" integer;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "final_round" integer;