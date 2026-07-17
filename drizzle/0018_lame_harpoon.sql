ALTER TYPE "public"."notification_type" ADD VALUE 'clan_message';--> statement-breakpoint
CREATE TABLE "clan_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_messages_clan_created_at_idx" ON "clan_messages" USING btree ("clan_id","created_at");