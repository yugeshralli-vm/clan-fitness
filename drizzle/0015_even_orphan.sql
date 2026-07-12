CREATE TYPE "public"."system_post_type" AS ENUM('weekly_recap');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'weekly_recap';--> statement-breakpoint
CREATE TABLE "system_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" uuid NOT NULL,
	"type" "system_post_type" DEFAULT 'weekly_recap' NOT NULL,
	"week_start" timestamp NOT NULL,
	"week_end" timestamp NOT NULL,
	"top_three" jsonb NOT NULL,
	"wall_of_shame" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "reactions_check_in_clan_user_emoji_idx";--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "check_in_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reactions" ALTER COLUMN "check_in_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "system_post_id" uuid;--> statement-breakpoint
ALTER TABLE "reactions" ADD COLUMN "system_post_id" uuid;--> statement-breakpoint
ALTER TABLE "system_posts" ADD CONSTRAINT "system_posts_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "system_posts_clan_type_week_idx" ON "system_posts" USING btree ("clan_id","type","week_start");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_system_post_id_system_posts_id_fk" FOREIGN KEY ("system_post_id") REFERENCES "public"."system_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_system_post_id_system_posts_id_fk" FOREIGN KEY ("system_post_id") REFERENCES "public"."system_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_system_post_clan_user_emoji_idx" ON "reactions" USING btree ("system_post_id","clan_id","user_id","emoji") WHERE "reactions"."system_post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_check_in_clan_user_emoji_idx" ON "reactions" USING btree ("check_in_id","clan_id","user_id","emoji") WHERE "reactions"."check_in_id" is not null;