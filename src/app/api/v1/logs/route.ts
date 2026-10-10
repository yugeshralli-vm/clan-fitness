import { NextResponse } from "next/server";
import { getTodaysCheckIn, getUserStreak, getUserWeeklyCount } from "@/features/check-ins/queries";
import { applyDailyCheckIn } from "@/features/check-ins/log-check-in";
import { getFoodPhotoUrls, sanitizeFoodPhotoUrls } from "@/features/check-ins/types";
import type {
  FoodCheckInValue,
  FoodStatus,
  GymCheckInValue,
  StepsCheckInValue,
  ThoughtCheckInValue,
} from "@/features/check-ins/types";
import { getUserGoals } from "@/features/goals";
import { apiError, requireApiUser } from "@/lib/api-response";
import { refreshUserTimezone } from "@/lib/current-user";
import { isValidTimeZone } from "@/lib/timezone-date";

const FOOD_STATUSES: readonly FoodStatus[] = ["yes", "no", "partial"];

async function buildLogsResponse(user: { id: string; timezone: string }) {
  const [gym, steps, food, thought, goals, gymStreak, weeklyGymCount] = await Promise.all([
    getTodaysCheckIn(user.id, "gym", user.timezone),
    getTodaysCheckIn(user.id, "steps", user.timezone),
    getTodaysCheckIn(user.id, "food", user.timezone),
    getTodaysCheckIn(user.id, "thought", user.timezone),
    getUserGoals(user.id),
    getUserStreak(user.id, "gym", user.timezone),
    getUserWeeklyCount(user.id, "gym", user.timezone),
  ]);

  const gymValue = gym?.value as GymCheckInValue | undefined;
  const stepsValue = steps?.value as StepsCheckInValue | undefined;
  const foodValue = food?.value as FoodCheckInValue | undefined;
  const thoughtValue = thought?.value as ThoughtCheckInValue | undefined;
  const dailyStepsTarget = goals.find((g) => g.type === "steps")?.targetValue ?? 8000;
  // Same defaults as the web Log page's summary card (src/app/(app)/logs/page.tsx).
  const weeklyGymTarget = goals.find((g) => g.type === "gym")?.targetValue ?? 4;

  return {
    gym: gym ? { note: gymValue?.note } : null,
    steps: steps ? { count: stepsValue?.count ?? 0 } : null,
    food: food ? { status: foodValue?.status, note: foodValue?.note, photoUrls: getFoodPhotoUrls(foodValue) } : null,
    thought: thought ? { text: thoughtValue?.text ?? "" } : null,
    dailyStepsTarget,
    weeklyGymCount,
    weeklyGymTarget,
    gymStreak,
    hasLoggedToday: !!(gym || steps || food || thought),
  };
}

export async function GET(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const timezoneParam = new URL(request.url).searchParams.get("timezone") ?? undefined;
  if (timezoneParam && !isValidTimeZone(timezoneParam)) return apiError(400, "Invalid timezone.");

  const user = await refreshUserTimezone(r.user, timezoneParam);

  return NextResponse.json(await buildLogsResponse(user));
}

export async function POST(request: Request) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "Invalid request body.");

  const { timezone, workedOut, gymNote, stepsCount, foodStatus, foodNote, photoUrls, thought } = body as {
    timezone?: string;
    workedOut?: boolean;
    gymNote?: string;
    stepsCount?: number;
    foodStatus?: FoodStatus;
    foodNote?: string;
    /** The day's full photo list (uploaded via /api/v1/uploads/food-photo). Omit to keep today's photos. */
    photoUrls?: unknown;
    thought?: string;
  };

  if (timezone !== undefined && !isValidTimeZone(timezone)) return apiError(400, "Invalid timezone.");
  if (stepsCount !== undefined && (!Number.isFinite(stepsCount) || stepsCount < 0)) {
    return apiError(400, "Enter a valid step count.");
  }
  if (foodStatus !== undefined && !FOOD_STATUSES.includes(foodStatus)) {
    return apiError(400, "Invalid food status.");
  }
  if (photoUrls !== undefined && !Array.isArray(photoUrls)) return apiError(400, "photoUrls must be an array.");

  const user = await refreshUserTimezone(r.user, timezone);

  // A food write replaces the day's photos, so an app version without photo support (no
  // photoUrls) must carry over the ones already there — e.g. added from the web — not wipe them.
  // Only when it's writing food anyway: carried-over photos alone would trigger a food write.
  const keptPhotoUrls =
    photoUrls !== undefined
      ? sanitizeFoodPhotoUrls(photoUrls)
      : foodStatus !== undefined
        ? getFoodPhotoUrls((await getTodaysCheckIn(user.id, "food", user.timezone))?.value as FoodCheckInValue | undefined)
        : undefined;

  await applyDailyCheckIn(user, { workedOut, gymNote, stepsCount, foodStatus, foodNote, photoUrls: keptPhotoUrls, thought });

  return NextResponse.json(await buildLogsResponse(user));
}
