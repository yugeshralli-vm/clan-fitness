import { NextResponse } from "next/server";
import { applyDailyCheckIn } from "@/features/check-ins/log-check-in";
import { getTodaysCheckIn } from "@/features/check-ins/queries";
import type { StepsCheckInValue } from "@/features/check-ins/types";
import { apiError, requireApiUser } from "@/lib/api-response";
import { refreshUserTimezone } from "@/lib/current-user";
import { isValidTimeZone } from "@/lib/timezone-date";

/**
 * Automatic step sync from the Android app (Health Connect). Unlike POST /api/v1/logs it only ever
 * raises today's count — a device can under-count (phone left on a desk, watch not synced yet), so
 * a bigger number someone typed in by hand wins. Steps only; nothing else on today's log changes.
 */
export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const body = await request.json().catch(() => null);
  const { stepsCount, timezone } = (body ?? {}) as { stepsCount?: number; timezone?: string };
  if (typeof stepsCount !== "number" || !Number.isInteger(stepsCount) || stepsCount < 0) {
    return apiError(400, "stepsCount must be a non-negative integer.");
  }
  if (timezone !== undefined && !isValidTimeZone(timezone)) return apiError(400, "Invalid timezone.");

  const user = await refreshUserTimezone(r.user, timezone);
  const existing = await getTodaysCheckIn(user.id, "steps", user.timezone);
  const current = (existing?.value as StepsCheckInValue | undefined)?.count ?? 0;

  if (existing && stepsCount <= current) {
    return NextResponse.json({ steps: current, updated: false });
  }
  await applyDailyCheckIn(user, { stepsCount });
  return NextResponse.json({ steps: stepsCount, updated: true });
}
