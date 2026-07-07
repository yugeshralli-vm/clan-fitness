import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { getStreaks, getUsersLoggedToday, getWeeklyCounts, getWeeklyStepsTotals } from "@/features/check-ins";
import {
  ClanLeaderboardSection,
  ClanMembersSection,
  ClanSettingsSheet,
  getClanById,
  getClanMembers,
} from "@/features/clans";
import { getGoalsForUsers } from "@/features/goals";

const DEFAULT_WEEKLY_GYM_TARGET = 4;
const DEFAULT_DAILY_STEPS_TARGET = 8000;
const STEP_WEIGHT = 0.4;
const GYM_WEIGHT = 0.4;
const STREAK_WEIGHT = 0.2;
const STREAK_CAP_DAYS = 7;

export default async function ManageClanPage({ params }: { params: Promise<{ clanId: string }> }) {
  const { clanId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // members already contains the current user's own row (with role), so a separate
  // getClanMembership call for the same table would be a redundant query.
  const [clan, members] = await Promise.all([getClanById(clanId), getClanMembers(clanId)]);
  const membership = members.find((m) => m.user.id === userId);
  if (!clan || !membership) notFound();

  const memberIds = members.map((m) => m.user.id);
  const [loggedToday, weeklyCounts, weeklyStepsTotals, streaks, gymGoals, stepsGoals] = await Promise.all([
    getUsersLoggedToday(memberIds),
    getWeeklyCounts(memberIds, "gym"),
    getWeeklyStepsTotals(memberIds),
    getStreaks(memberIds, "gym"),
    getGoalsForUsers(memberIds, "gym"),
    getGoalsForUsers(memberIds, "steps"),
  ]);
  const isAdmin = membership.role === "admin";

  // Position is a weighted composite of three 0-100 scores, each capped at 100 so blowing past a
  // goal can't be used to coast on the others: steps % of personal goal (40%), gym % of personal
  // goal (40%), and streak normalized against a 7-day cap (20%). Streak is folded into the score
  // itself rather than left as a pure tiebreaker, since a long streak reflects real consistency
  // that neither of the other two metrics captures on its own.
  const leaderboard = members
    .map(({ user }) => {
      const weeklyCount = weeklyCounts.get(user.id) ?? 0;
      const weeklyTarget = gymGoals.get(user.id) ?? DEFAULT_WEEKLY_GYM_TARGET;
      const weeklySteps = weeklyStepsTotals.get(user.id) ?? 0;
      const weeklyStepsTarget = (stepsGoals.get(user.id) ?? DEFAULT_DAILY_STEPS_TARGET) * 7;
      const streak = streaks.get(user.id) ?? 0;

      const stepPct = Math.min(weeklySteps / weeklyStepsTarget, 1) * 100;
      const gymPct = Math.min(weeklyCount / weeklyTarget, 1) * 100;
      const streakPct = Math.min(streak / STREAK_CAP_DAYS, 1) * 100;
      const score = STEP_WEIGHT * stepPct + GYM_WEIGHT * gymPct + STREAK_WEIGHT * streakPct;

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
