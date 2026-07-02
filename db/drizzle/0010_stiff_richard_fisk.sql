ALTER TYPE "public"."dq_reason" ADD VALUE 'over_cap' BEFORE 'deleted';--> statement-breakpoint
ALTER TABLE "contest" ADD CONSTRAINT "contest_videoId_unique" UNIQUE("video_id");