import { NextResponse } from "next/server";
import { getAppConfig } from "@/features/admin/config";
import { getFilteredHistoryForUser } from "@/features/check-ins/history-actions";
import { getUserStepsByDay } from "@/features/check-ins/queries";
import { getMyLivePendingPoints } from "@/features/clan-contracts/actions";
import { levelForPoints, levelProgress } from "@/features/clan-contracts/level";
import { getSharedClans } from "@/features/clans/queries";
import { getUserGoals } from "@/features/goals";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { calculateAge, calculateBmi } from "@/features/profile/calculations";
import { toApiHistory } from "@/lib/api-history";
import { apiError, requireApiUser } from "@/lib/api-response";
import { getUserById } from "@/lib/current-user";
import { getUserMonthDays, startOfUserDay, startOfUserMonth } from "@/lib/timezone-date";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;

/**
 * GET /api/v1/users/:userId — a profile page's data (web /profile for yourself, /members/:userId
 * for a clanmate): name, bio, level, this month's steps heatmap and the first page of history
 * (all types, 30 days). For yourself it adds what /profile's settings and level summary show —
 * goals, body details, notification preferences, level progress including today's pending points.
 * Anyone else must share a clan with the viewer.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { userId } = await params;
  const isMe = userId === r.user.id;

  const target = isMe ? r.user : await getUserById(userId);
  // Same rule as the web member page: only clanmates can see each other.
  if (!target || (!isMe && (await getSharedClans(r.user.id, userId)).length === 0)) {
    return apiError(404, "Not found.");
  }

  const now = new Date();
  const monthStart = startOfUserMonth(target.timezone, now);
  const tomorrowStart = new Date(startOfUserDay(target.timezone, now).getTime() + 24 * 60 * 60 * 1000);
  const [goals, stepsByDay, history, config] = await Promise.all([
    getUserGoals(target.id),
    getUserStepsByDay(target.id, { start: monthStart, end: tomorrowStart }, target.timezone),
    getFilteredHistoryForUser(target.id, "all", "30d"),
    getAppConfig(),
  ]);

  const gymGoal = goals.find((g) => g.type === "gym")?.targetValue ?? null;
  const stepsGoal = goals.find((g) => g.type === "steps")?.targetValue ?? null;
  const dailyStepsTarget = stepsGoal ?? 8000;
  const heatmap = getUserMonthDays(target.timezone, now).map((day) => {
    const base = { dayKey: day.dayKey, dayOfWeek: day.dayOfWeek };
    if (day.date.getTime() > now.getTime()) return { ...base, state: "future" as const };
    const steps = stepsByDay.get(day.dayKey);
    if (steps === undefined) return { ...base, state: "none" as const };
    return { ...base, state: steps >= dailyStepsTarget ? ("met" as const) : ("under" as const) };
  });

  const profile = {
    user: {
      id: target.id,
      name: target.name,
      avatarUrl: target.avatarUrl,
      bio: target.bio,
      level: levelForPoints(target.totalPoints, config),
      timezone: target.timezone,
    },
    isMe,
    heatmap,
    history: toApiHistory(history),
  };
  if (!isMe) return NextResponse.json(profile);

  const [preferences, pendingPoints] = await Promise.all([getNotificationPreferences(target.id), getMyLivePendingPoints()]);
  const heightCm = target.heightCm ?? null;
  const weightKg = target.weightKg ? Number(target.weightKg) : null;
  const imperial = target.unitsPreference === "imperial";

  return NextResponse.json({
    ...profile,
    goals: { gymDaysPerWeek: gymGoal, stepsPerDay: stepsGoal },
    // Height/weight in the user's chosen units, as the web settings form shows and accepts them.
    details: {
      unitsPreference: target.unitsPreference,
      height: heightCm === null ? null : imperial ? Math.round(heightCm / CM_PER_INCH) : heightCm,
      weight: weightKg === null ? null : imperial ? Math.round(weightKg / KG_PER_LB) : weightKg,
      dateOfBirth: target.dateOfBirth,
      gender: target.gender,
      bio: target.bio,
      age: target.dateOfBirth ? calculateAge(target.dateOfBirth) : null,
      bmi: heightCm && weightKg ? calculateBmi(heightCm, weightKg) : null,
    },
    notificationPreferences: {
      notifyOnComments: preferences?.notifyOnComments ?? true,
      notifyOnMentions: preferences?.notifyOnMentions ?? true,
      notifyOnReactions: preferences?.notifyOnReactions ?? true,
      notifyOnCheckIns: preferences?.notifyOnCheckIns ?? true,
    },
    // Today's claimed-and-already-met contracts count toward the bar, like the web summary.
    levelProgress: { ...levelProgress(target.totalPoints + pendingPoints, config), totalPoints: target.totalPoints, pendingPoints },
  });
}
