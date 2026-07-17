import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { getFilteredHistoryForUser, getUserStepsByDay } from "@/features/check-ins";
import { getSharedClans } from "@/features/clans";
import { getUserGoals } from "@/features/goals";
import { ActivityHeatmap, HistorySection } from "@/features/profile";
import type { HeatmapDay } from "@/features/profile";
import { getUserById } from "@/lib/current-user";
import { getUserMonthDays, startOfUserDay, startOfUserMonth } from "@/lib/timezone-date";

export default async function MemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { userId: viewerId } = await auth();
  if (!viewerId) redirect("/sign-in");
  if (userId === viewerId) redirect("/profile");

  const target = await getUserById(userId);
  if (!target) notFound();

  // Same visibility rule as everywhere else in the app (feed/leaderboard/comments): only
  // clan-mates can see each other. This route is a guessable URL, so this has to be a real check,
  // not just "the UI doesn't link here otherwise."
  const sharedClans = await getSharedClans(viewerId, userId);
  if (sharedClans.length === 0) notFound();

  const now = new Date();
  const monthStart = startOfUserMonth(target.timezone, now);
  const tomorrowStart = new Date(startOfUserDay(target.timezone, now).getTime() + 24 * 60 * 60 * 1000);

  const [goals, stepsByDay, history] = await Promise.all([
    getUserGoals(target.id),
    getUserStepsByDay(target.id, { start: monthStart, end: tomorrowStart }, target.timezone),
    getFilteredHistoryForUser(target.id, "all", "30d"),
  ]);

  const stepsGoal = goals.find((g) => g.type === "steps");
  const dailyStepsTarget = stepsGoal?.targetValue ?? 8000;

  const heatmapDays: HeatmapDay[] = getUserMonthDays(target.timezone, now).map((day) => {
    if (day.date.getTime() > now.getTime()) return { ...day, state: "future" };
    const steps = stepsByDay.get(day.dayKey);
    if (steps === undefined) return { ...day, state: "none" };
    return { ...day, state: steps >= dailyStepsTarget ? "met" : "under" };
  });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Avatar src={target.avatarUrl} name={target.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-foreground">{target.name}</h1>
          {target.bio && <p className="truncate text-sm text-foreground-secondary">{target.bio}</p>}
        </div>
      </div>

      <ActivityHeatmap days={heatmapDays} />

      <HistorySection
        initialDays={history.days}
        initialHasMore={history.hasMore}
        timezone={target.timezone}
        userId={target.id}
      />
    </div>
  );
}
