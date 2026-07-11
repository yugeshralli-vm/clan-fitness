CREATE TYPE "public"."feedback_sender" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'feedback';--> statement-breakpoint
CREATE TABLE "feedback_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sender" "feedback_sender" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_messages_user_created_at_idx" ON "feedback_messages" USING btree ("user_id","created_at");