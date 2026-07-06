CREATE TYPE "public"."gender" AS ENUM('female', 'male', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."units_preference" AS ENUM('metric', 'imperial');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "weight_kg" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "units_preference" "units_preference" DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;