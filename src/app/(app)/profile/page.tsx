import { redirect } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { getAppConfig } from "@/features/admin/config";
import { getFilteredHistory, getUserStepsByDay } from "@/features/check-ins";
import { levelProgress, ProfileLevelSummary } from "@/features/clan-contracts";
import { getUserGoals } from "@/features/goals";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { ActivityHeatmap, calculateAge, calculateBmi, HistorySection, ProfileSettingsSheet } from "@/features/profile";
import type { HeatmapDay } from "@/features/profile";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { getUserMonthDays, startOfUserDay, startOfUserMonth } from "@/lib/timezone-date";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;

export default async function ProfilePage() {
  const user = await getOrSyncCurrentUser();
  if (!user) redirect("/sign-in");

  const now = new Date();
  const monthStart = startOfUserMonth(user.timezone, now);
  const tomorrowStart = new Date(startOfUserDay(user.timezone, now).getTime() + 24 * 60 * 60 * 1000);

  const [goals, stepsByDay, history, notificationPreferences, config] = await Promise.all([
    getUserGoals(user.id),
    getUserStepsByDay(user.id, { start: monthStart, end: tomorrowStart }, user.timezone),
    getFilteredHistory("all", "30d"),
    getNotificationPreferences(user.id),
    getAppConfig(),
  ]);

  const gymGoal = goals.find((g) => g.type === "gym");
  const stepsGoal = goals.find((g) => g.type === "steps");
  const dailyStepsTarget = stepsGoal?.targetValue ?? 8000;

  const heatmapDays: HeatmapDay[] = getUserMonthDays(user.timezone, now).map((day) => {
    if (day.date.getTime() > now.getTime()) return { ...day, state: "future" };
    const steps = stepsByDay.get(day.dayKey);
    if (steps === undefined) return { ...day, state: "none" };
    return { ...day, state: steps >= dailyStepsTarget ? "met" : "under" };
  });

  const unitsPreference = user.unitsPreference;
  const heightCm = user.heightCm ?? undefined;
  const weightKg = user.weightKg ? Number(user.weightKg) : undefined;
  const heightDisplay =
    heightCm === undefined
      ? undefined
      : unitsPreference === "imperial"
        ? Math.round(heightCm / CM_PER_INCH)
        : heightCm;
  const weightDisplay =
    weightKg === undefined
      ? undefined
      : unitsPreference === "imperial"
        ? Math.round(weightKg / KG_PER_LB)
        : weightKg;

  const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : undefined;
  const bmi = heightCm && weightKg ? calculateBmi(heightCm, weightKg) : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Avatar src={user.avatarUrl} name={user.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-foreground">{user.name}</h1>
          {user.bio && <p className="truncate text-sm text-foreground-secondary">{user.bio}</p>}
        </div>
        <ProfileSettingsSheet
          gymTarget={gymGoal?.targetValue}
          stepsTarget={stepsGoal?.targetValue}
          age={age}
          bmi={bmi}
          heightDisplay={heightDisplay}
          weightDisplay={weightDisplay}
          dateOfBirth={user.dateOfBirth ?? undefined}
          gender={user.gender ?? undefined}
          unitsPreference={unitsPreference}
          bio={user.bio ?? undefined}
          notificationPreferences={{
            notifyOnComments: notificationPreferences?.notifyOnComments ?? true,
            notifyOnMentions: notificationPreferences?.notifyOnMentions ?? true,
            notifyOnReactions: notificationPreferences?.notifyOnReactions ?? true,
            notifyOnCheckIns: notificationPreferences?.notifyOnCheckIns ?? true,
          }}
        />
      </div>

      <ProfileLevelSummary userId={user.id} progress={levelProgress(user.totalPoints, config)} />

      <ActivityHeatmap days={heatmapDays} />

      <HistorySection initialDays={history.days} initialHasMore={history.hasMore} timezone={user.timezone} />
    </div>
  );
}
