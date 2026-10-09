import { NextResponse } from "next/server";
import { getTodaysCheckIn } from "@/features/check-ins/queries";
import { applyDailyCheckIn } from "@/features/check-ins/log-check-in";
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
  const [gym, steps, food, thought, goals] = await Promise.all([
    getTodaysCheckIn(user.id, "gym", user.timezone),
    getTodaysCheckIn(user.id, "steps", user.timezone),
    getTodaysCheckIn(user.id, "food", user.timezone),
    getTodaysCheckIn(user.id, "thought", user.timezone),
    getUserGoals(user.id),
  ]);

  const gymValue = gym?.value as GymCheckInValue | undefined;
  const stepsValue = steps?.value as StepsCheckInValue | undefined;
  const foodValue = food?.value as FoodCheckInValue | undefined;
  const thoughtValue = thought?.value as ThoughtCheckInValue | undefined;
  const dailyStepsTarget = goals.find((g) => g.type === "steps")?.targetValue ?? 8000;

  return {
    gym: gym ? { note: gymValue?.note } : null,
    steps: steps ? { count: stepsValue?.count ?? 0 } : null,
    food: food ? { status: foodValue?.status, note: foodValue?.note } : null,
    thought: thought ? { text: thoughtValue?.text ?? "" } : null,
    dailyStepsTarget,
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

  const { timezone, workedOut, gymNote, stepsCount, foodStatus, foodNote, thought } = body as {
    timezone?: string;
    workedOut?: boolean;
    gymNote?: string;
    stepsCount?: number;
    foodStatus?: FoodStatus;
    foodNote?: string;
    thought?: string;
  };

  if (timezone !== undefined && !isValidTimeZone(timezone)) return apiError(400, "Invalid timezone.");
  if (stepsCount !== undefined && (!Number.isFinite(stepsCount) || stepsCount < 0)) {
    return apiError(400, "Enter a valid step count.");
  }
  if (foodStatus !== undefined && !FOOD_STATUSES.includes(foodStatus)) {
    return apiError(400, "Invalid food status.");
  }

  const user = await refreshUserTimezone(r.user, timezone);

  await applyDailyCheckIn(user, { workedOut, gymNote, stepsCount, foodStatus, foodNote, thought });

  return NextResponse.json(await buildLogsResponse(user));
}
