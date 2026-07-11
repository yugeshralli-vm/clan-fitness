CREATE TYPE "public"."broadcast_target_type" AS ENUM('clan', 'user');--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "target_type" "broadcast_target_type" DEFAULT 'clan' NOT NULL;