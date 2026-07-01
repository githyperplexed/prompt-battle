CREATE TABLE "similarity" (
	"id" text PRIMARY KEY NOT NULL,
	"contest_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"cluster_id" integer NOT NULL,
	"nearest_earlier_entry_id" text,
	"cosine" real NOT NULL,
	"lexical" real NOT NULL,
	"originality_penalty" real DEFAULT 0 NOT NULL,
	"config_hash" text NOT NULL,
	"field_fingerprint" text NOT NULL,
	"embedding_model" text NOT NULL,
	"preprocessing_version" integer NOT NULL,
	"embedding" text,
	"audit" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contest" ADD COLUMN "similarity_computed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contest" ADD COLUMN "similarity_fingerprint" text;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "raw_absolute_score" real;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "originality_penalty" real;--> statement-breakpoint
ALTER TABLE "similarity" ADD CONSTRAINT "similarity_contest_id_contest_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity" ADD CONSTRAINT "similarity_entry_id_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity" ADD CONSTRAINT "similarity_nearest_earlier_entry_id_entry_id_fk" FOREIGN KEY ("nearest_earlier_entry_id") REFERENCES "public"."entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similarity" ADD CONSTRAINT "similarity_contest_entry_fk" FOREIGN KEY ("contest_id","entry_id") REFERENCES "public"."entry"("contest_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "similarity_entry_unique" ON "similarity" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "similarity_contest_idx" ON "similarity" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "similarity_fingerprint_idx" ON "similarity" USING btree ("contest_id","field_fingerprint");