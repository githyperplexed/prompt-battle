ALTER TYPE "public"."dq_reason" ADD VALUE 'edited_after_cutoff' BEFORE 'deleted';--> statement-breakpoint
ALTER TABLE "contest" ADD COLUMN "captured_at" timestamp with time zone;