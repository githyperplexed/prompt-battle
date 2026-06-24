CREATE TYPE "public"."contest_status" AS ENUM('draft', 'open', 'snapshotted', 'scoring', 'complete');--> statement-breakpoint
CREATE TYPE "public"."dq_reason" AS ENUM('missing_keywords', 'too_short', 'too_long', 'has_url', 'duplicate_channel', 'affiliated', 'tos', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('eligible', 'disqualified');--> statement-breakpoint
CREATE TABLE "contest" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"video_published_at" timestamp with time zone NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"status" "contest_status" DEFAULT 'draft' NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"youtube_comment_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_display_name" text NOT NULL,
	"text" text NOT NULL,
	"char_count" integer NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"status" "entry_status" DEFAULT 'eligible' NOT NULL,
	"dq_reason" "dq_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"model_id" text NOT NULL,
	"persuasiveness" smallint NOT NULL,
	"originality" smallint NOT NULL,
	"cleverness" smallint NOT NULL,
	"execution" smallint NOT NULL,
	"total" smallint NOT NULL,
	"nonce" text NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchup" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"round" integer NOT NULL,
	"slot" integer NOT NULL,
	"entry_a_id" text NOT NULL,
	"entry_b_id" text NOT NULL,
	"winner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparison" (
	"id" text PRIMARY KEY NOT NULL,
	"matchup_id" text NOT NULL,
	"model_id" text NOT NULL,
	"order_swapped" boolean NOT NULL,
	"chosen_entry_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_entry_id_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_entry_a_id_entry_id_fk" FOREIGN KEY ("entry_a_id") REFERENCES "public"."entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_entry_b_id_entry_id_fk" FOREIGN KEY ("entry_b_id") REFERENCES "public"."entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_winner_id_entry_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison" ADD CONSTRAINT "comparison_matchup_id_matchup_id_fk" FOREIGN KEY ("matchup_id") REFERENCES "public"."matchup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison" ADD CONSTRAINT "comparison_chosen_entry_id_entry_id_fk" FOREIGN KEY ("chosen_entry_id") REFERENCES "public"."entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entry_contest_comment_unique" ON "entry" USING btree ("contest_id","youtube_comment_id");--> statement-breakpoint
CREATE INDEX "entry_contest_channel_idx" ON "entry" USING btree ("contest_id","channel_id");--> statement-breakpoint
CREATE INDEX "entry_contest_status_idx" ON "entry" USING btree ("contest_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "score_entry_model_unique" ON "score" USING btree ("entry_id","model_id");--> statement-breakpoint
CREATE INDEX "score_contest_idx" ON "score" USING btree ("contest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matchup_contest_round_slot_unique" ON "matchup" USING btree ("contest_id","round","slot");--> statement-breakpoint
CREATE INDEX "matchup_contest_idx" ON "matchup" USING btree ("contest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_matchup_model_order_unique" ON "comparison" USING btree ("matchup_id","model_id","order_swapped");