"use server";

import { revalidatePath } from "next/cache";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { applyDailyCheckIn } from "./log-check-in";
import type { FoodStatus } from "./types";

export type CheckInActionState = { error?: string } | undefined;

// Photos are uploaded client-direct to Vercel Blob (see src/app/api/check-ins/upload/route.ts) —
// this Server Action only ever receives the resulting URLs, never raw file bytes. This check
// isn't a security boundary (next/image's own remotePatterns allowlist already refuses to render
// an unlisted host, so a forged value would at worst show a broken image), just a cheap sanity
// filter against a hand-crafted form submission.
const BLOB_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

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
  const photoUrls = formData
    .getAll("photoUrls")
    .filter((v): v is string => typeof v === "string" && BLOB_URL_PATTERN.test(v))
    .slice(0, 3);

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
