import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { getAppConfig } from "@/features/admin";
import {
  getStepGoalStreaks,
  getUsersLoggedToday,
  getWeeklyCounts,
  getWeeklyStepsTotals,
} from "@/features/check-ins";
import {
  ClanLeaderboardSection,
  ClanMembersSection,
  ClanSettingsSheet,
  getClanById,
  getClanMembers,
} from "@/features/clans";
import { getGoalsForUsers } from "@/features/goals";

export default async function ManageClanPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // members already contains the current user's own row (with role), so a separate
  // getClanMembership call for the same table would be a redundant query.
  const [clan, members, config] = await Promise.all([
    getClanById(clanId),
    getClanMembers(clanId),
    getAppConfig(),
  ]);
  const membership = members.find((m) => m.user.id === userId);
  if (!clan || !membership) notFound();

  const { stepWeight, streakWeight, gymWeight, streakCapDays, defaultWeeklyGymTarget, defaultDailyStepsTarget } =
    config;

  const memberIds = members.map((m) => m.user.id);
  const [loggedToday, weeklyCounts, weeklyStepsTotals, gymGoals, stepsGoals] = await Promise.all([
    getUsersLoggedToday(memberIds),
    getWeeklyCounts(memberIds, "gym"),
    getWeeklyStepsTotals(memberIds),
    getGoalsForUsers(memberIds, "gym"),
    getGoalsForUsers(memberIds, "steps"),
  ]);
  const isAdmin = membership.role === "admin";

  // Gym turnout is low across most clans, so gym only gets a minority weight rather than being
  // dropped outright: % of weekly steps goal (50%), a streak of days the steps *goal* was
  // actually hit rather than just logged, capped at 7 days (25%), and % of weekly gym goal (25%).
  // All of these — the three weights, the streak cap, and the two defaults below — are
  // admin-tunable from /admin without a deploy (see src/features/admin/config.ts).
  const dailyStepTargets = new Map(
    memberIds.map((id) => [id, stepsGoals.get(id) ?? defaultDailyStepsTarget]),
  );
  const streaks = await getStepGoalStreaks(memberIds, dailyStepTargets);

  const leaderboard = members
    .map(({ user }) => {
      const weeklyCount = weeklyCounts.get(user.id) ?? 0;
      const weeklyTarget = gymGoals.get(user.id) ?? defaultWeeklyGymTarget;
      const weeklySteps = weeklyStepsTotals.get(user.id) ?? 0;
      const weeklyStepsTarget = (stepsGoals.get(user.id) ?? defaultDailyStepsTarget) * 7;
      const streak = streaks.get(user.id) ?? 0;

      const stepPct = Math.min(weeklySteps / weeklyStepsTarget, 1) * 100;
      const gymPct = Math.min(weeklyCount / weeklyTarget, 1) * 100;
      const streakPct = Math.min(streak / streakCapDays, 1) * 100;
      const score = stepWeight * stepPct + streakWeight * streakPct + gymWeight * gymPct;

      return { user, weeklyCount, weeklyTarget, weeklySteps, weeklyStepsTarget, streak, stepPct, gymPct, score };
    })
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.user.name.localeCompare(b.user.name));

  const tabs: TabItem[] = [
    { id: "leaderboard", label: "Leaderboard", content: <ClanLeaderboardSection leaderboard={leaderboard} /> },
    {
      id: "members",
      label: "Members",
      content: (
        <ClanMembersSection clanId={clanId} members={members} isAdmin={isAdmin} loggedToday={loggedToday} />
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{clan.name}</h1>
          <p className="text-sm text-foreground-tertiary">
            {members.length}/{clan.maxSize} members
          </p>
        </div>
        {isAdmin && (
          <div className="shrink-0">
            <ClanSettingsSheet clanId={clanId} clanName={clan.name} inviteCode={clan.inviteCode} />
          </div>
        )}
      </div>

      <Tabs tabs={tabs} />
    </div>
  );
}
