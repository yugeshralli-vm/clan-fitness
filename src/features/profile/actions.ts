"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import type { Gender, UnitsPreference } from "./types";

export type ProfileDetailsActionState = { error?: string } | undefined;

const GENDERS: Gender[] = ["female", "male", "other", "prefer_not_to_say"];
const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;

export async function updateProfileDetails(
  _prevState: ProfileDetailsActionState,
  formData: FormData,
): Promise<ProfileDetailsActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const unitsPreference: UnitsPreference =
    formData.get("unitsPreference") === "imperial" ? "imperial" : "metric";

  const heightRaw = String(formData.get("height") ?? "").trim();
  let heightCm: number | null = null;
  if (heightRaw) {
    const value = Number(heightRaw);
    if (!Number.isFinite(value) || value <= 0) return { error: "Enter a valid height." };
    heightCm = Math.round(unitsPreference === "imperial" ? value * CM_PER_INCH : value);
  }

  const weightRaw = String(formData.get("weight") ?? "").trim();
  let weightKg: string | null = null;
  if (weightRaw) {
    const value = Number(weightRaw);
    if (!Number.isFinite(value) || value <= 0) return { error: "Enter a valid weight." };
    weightKg = (unitsPreference === "imperial" ? value * KG_PER_LB : value).toFixed(1);
  }

  const dateOfBirthRaw = String(formData.get("dateOfBirth") ?? "").trim();
  let dateOfBirth: string | null = null;
  if (dateOfBirthRaw) {
    const parsed = new Date(dateOfBirthRaw);
    if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
      return { error: "Enter a valid date of birth." };
    }
    dateOfBirth = dateOfBirthRaw;
  }

  const genderRaw = String(formData.get("gender") ?? "");
  const gender = (GENDERS as string[]).includes(genderRaw) ? (genderRaw as Gender) : null;

  const bio = String(formData.get("bio") ?? "").trim().slice(0, 200) || null;

  await db
    .update(users)
    .set({ heightCm, weightKg, dateOfBirth, gender, unitsPreference, bio })
    .where(eq(users.id, user.id));

  revalidatePath("/profile");
}
