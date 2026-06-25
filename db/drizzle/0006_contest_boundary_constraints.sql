ALTER TABLE "entry" ADD CONSTRAINT "entry_contest_id_unique" UNIQUE("contest_id","id");--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_contest_entry_fk" FOREIGN KEY ("contest_id","entry_id") REFERENCES "public"."entry"("contest_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_contest_entry_a_fk" FOREIGN KEY ("contest_id","entry_a_id") REFERENCES "public"."entry"("contest_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_contest_entry_b_fk" FOREIGN KEY ("contest_id","entry_b_id") REFERENCES "public"."entry"("contest_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup" ADD CONSTRAINT "matchup_contest_winner_fk" FOREIGN KEY ("contest_id","winner_id") REFERENCES "public"."entry"("contest_id","id") ON DELETE no action ON UPDATE no action;
