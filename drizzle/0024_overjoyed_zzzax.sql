CREATE TYPE "public"."contract_claim_status" AS ENUM('claimed', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "clan_contract_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"contract_id" text NOT NULL,
	"day_key" text NOT NULL,
	"status" "contract_claim_status" DEFAULT 'claimed' NOT NULL,
	"points_awarded" integer,
	"meta" jsonb,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_contract_claims" ADD CONSTRAINT "clan_contract_claims_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_contract_claims" ADD CONSTRAINT "clan_contract_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clan_contract_claims_clan_contract_day_idx" ON "clan_contract_claims" USING btree ("clan_id","contract_id","day_key");--> statement-breakpoint
CREATE INDEX "clan_contract_claims_clan_user_day_idx" ON "clan_contract_claims" USING btree ("clan_id","user_id","day_key");