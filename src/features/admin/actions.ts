"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { isAdminUser } from "./auth";
import type { ConfigKey } from "./config";

export type AdminActionState = { error?: string } | undefined;

export async function updateAppConfig(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { userId } = await auth();
  if (!isAdminUser(userId)) return { error: "Not authorized." };

  const stepWeight = Number(formData.get("stepWeight"));
  const streakWeight = Number(formData.get("streakWeight"));
  const gymWeight = Number(formData.get("gymWeight"));
  if (![stepWeight, streakWeight, gymWeight].every((w) => Number.isFinite(w) && w >= 0 && w <= 1)) {
    return { error: "Each weight must be a number between 0 and 1." };
  }
  const weightSum = stepWeight + streakWeight + gymWeight;
  if (Math.abs(weightSum - 1) > 0.01) {
    return { error: `Step, streak, and gym weights should add up to 1 (currently ${weightSum.toFixed(2)}).` };
  }

  const streakCapDays = Number(formData.get("streakCapDays"));
  if (!Number.isInteger(streakCapDays) || streakCapDays < 1 || streakCapDays > 30) {
    return { error: "Streak cap must be a whole number of days between 1 and 30." };
  }

  const defaultWeeklyGymTarget = Number(formData.get("defaultWeeklyGymTarget"));
  if (!Number.isInteger(defaultWeeklyGymTarget) || defaultWeeklyGymTarget < 1 || defaultWeeklyGymTarget > 7) {
    return { error: "Default gym target must be a whole number between 1 and 7." };
  }

  const defaultDailyStepsTarget = Number(formData.get("defaultDailyStepsTarget"));
  if (!Number.isInteger(defaultDailyStepsTarget) || defaultDailyStepsTarget < 1) {
    return { error: "Default steps target must be a positive whole number." };
  }

  const values: Record<ConfigKey, number> = {
    stepWeight,
    streakWeight,
    gymWeight,
    streakCapDays,
    defaultWeeklyGymTarget,
    defaultDailyStepsTarget,
  };

  await Promise.all(
    Object.entries(values).map(([key, value]) =>
      db
        .insert(appConfig)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: appConfig.key, set: { value: String(value), updatedAt: new Date() } }),
    ),
  );

  revalidatePath("/admin");
  revalidatePath("/clans/[clanId]/manage", "page");
}
