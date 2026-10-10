"use server";

import { revalidatePath } from "next/cache";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { applyDailyCheckIn } from "./log-check-in";
import { sanitizeFoodPhotoUrls, type FoodStatus } from "./types";

export type CheckInActionState = { error?: string } | undefined;

export async function logDailyCheckIn(
  _prevState: CheckInActionState,
  formData: FormData,
): Promise<CheckInActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const stepsRaw = String(formData.get("count") ?? "").trim();
  const stepsCount = stepsRaw ? Number(stepsRaw) : undefined;
  if (stepsCount !== undefined && (!Number.isFinite(stepsCount) || stepsCount < 0)) {
    return { error: "Enter a valid step count." };
  }

  const status = String(formData.get("status") ?? "") as FoodStatus;
  const foodStatus = (["yes", "no", "partial"] as const).includes(status) ? status : undefined;
  const photoUrls = sanitizeFoodPhotoUrls(formData.getAll("photoUrls"));

  await applyDailyCheckIn(user, {
    workedOut: formData.get("workedOut") === "on",
    // Always a string (empty = cleared), never undefined — undefined means "leave the note alone".
    gymNote: String(formData.get("gymNote") ?? "").trim(),
    stepsCount,
    foodStatus,
    foodNote: String(formData.get("foodNote") ?? "").trim() || undefined,
    photoUrls,
    thought: String(formData.get("thought") ?? "").trim().slice(0, 200) || undefined,
  });

  revalidatePath("/logs");
}
