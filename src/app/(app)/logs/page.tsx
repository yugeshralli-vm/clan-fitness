import { redirect } from "next/navigation";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  DailyLogForm,
  getTodaysCheckIn,
  getUserStreak,
  getUserWeeklyCount,
} from "@/features/check-ins";
import { getFoodPhotoUrls } from "@/features/check-ins/types";
import type {
  FoodCheckInValue,
  GymCheckInValue,
  StepsCheckInValue,
  ThoughtCheckInValue,
} from "@/features/check-ins/types";
import { getUserGoals } from "@/features/goals";
import { getOrSyncCurrentUser } from "@/lib/current-user";

export default async function LogsPage() {
  const user = await getOrSyncCurrentUser();
  if (!user) redirect("/sign-in");

  const [gymCheckIn, stepsCheckIn, foodCheckIn, thoughtCheckIn, gymStreak, weeklyGymCount, goals] =
    await Promise.all([
      getTodaysCheckIn(user.id, "gym", user.timezone),
      getTodaysCheckIn(user.id, "steps", user.timezone),
      getTodaysCheckIn(user.id, "food", user.timezone),
      getTodaysCheckIn(user.id, "thought", user.timezone),
      getUserStreak(user.id, "gym", user.timezone),
      getUserWeeklyCount(user.id, "gym", user.timezone),
      getUserGoals(user.id),
    ]);

  const gymValue = gymCheckIn?.value as GymCheckInValue | undefined;
  const stepsValue = stepsCheckIn?.value as StepsCheckInValue | undefined;
  const foodValue = foodCheckIn?.value as FoodCheckInValue | undefined;
  const thoughtValue = thoughtCheckIn?.value as ThoughtCheckInValue | undefined;
  const gymGoal = goals.find((g) => g.type === "gym");
  const stepsGoal = goals.find((g) => g.type === "steps");
  const weeklyGymTarget = gymGoal?.targetValue ?? 4;
  const dailyStepsTarget = stepsGoal?.targetValue ?? 8000;
  const todaysSteps = stepsValue?.count ?? 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-8">
      <section className="flex flex-col gap-5 rounded-xl border border-surface-border bg-surface p-5">
        <p className="text-sm font-semibold text-foreground-secondary">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: user.timezone,
          })}
        </p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProgressRing value={weeklyGymCount} max={weeklyGymTarget}>
              <span className="text-lg font-bold text-foreground">
                {weeklyGymCount}
                <span className="text-foreground-tertiary">/{weeklyGymTarget}</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-tertiary">
                days
              </span>
            </ProgressRing>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                This week
              </p>
              <p className="text-sm text-foreground-secondary">gym days</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
              Streak
            </p>
            <p className="text-3xl font-bold text-ember">{gymStreak} 🔥</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-foreground-tertiary">
              Steps today
            </span>
            <span className="text-foreground-secondary">
              {todaysSteps.toLocaleString()} / {dailyStepsTarget.toLocaleString()}
            </span>
          </div>
          <ProgressBar value={todaysSteps} max={dailyStepsTarget} />
        </div>
      </section>

      <DailyLogForm
        alreadyWorkedOut={!!gymCheckIn}
        existingGymNote={gymValue?.note}
        todaysSteps={stepsValue?.count}
        dailyStepsTarget={dailyStepsTarget}
        currentFoodStatus={foodValue?.status}
        existingFoodNote={foodValue?.note}
        existingPhotoUrls={getFoodPhotoUrls(foodValue)}
        existingThought={thoughtValue?.text}
        hasLoggedToday={!!(gymCheckIn || stepsCheckIn || foodCheckIn || thoughtCheckIn)}
      />
    </div>
  );
}
