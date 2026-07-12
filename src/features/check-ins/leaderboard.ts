import "server-only";

import type { users } from "@/db/schema";
import { getStepGoalStreaks, getWeeklyCounts, getWeeklyStepsTotals } from "./queries";

type ClanMember = { user: typeof users.$inferSelect; role: string; joinedAt: Date };

type LeaderboardConfig = {
  stepWeight: number;
  streakWeight: number;
  gymWeight: number;
  streakCapDays: number;
  defaultWeeklyGymTarget: number;
  defaultDailyStepsTarget: number;
};

export type LeaderboardEntry = {
  user: typeof users.$inferSelect;
  weeklyCount: number;
  weeklyTarget: number;
  weeklySteps: number;
  weeklyStepsTarget: number;
  streak: number;
  stepPct: number;
  gymPct: number;
  score: number;
};

type MemberStats = {
  weeklyCount: number;
  weeklyTarget: number;
  weeklySteps: number;
  weeklyStepsTarget: number;
  streak: number;
};

// Pure so the weighted formula and tie-break are trivially eyeballed/tested in isolation from the
// DB — this is the one formula behind every leaderboard this app shows (the live manage-page tab
// and the weekly Top 3/Wall of Shame recap).
function scoreMembers(
  members: ClanMember[],
  config: LeaderboardConfig,
  statsByUser: Map<string, MemberStats>,
): LeaderboardEntry[] {
  const { stepWeight, streakWeight, gymWeight, streakCapDays } = config;

  return members
    .map(({ user }) => {
      const stats = statsByUser.get(user.id)!;
      const stepPct = Math.min(stats.weeklySteps / stats.weeklyStepsTarget, 1) * 100;
      const gymPct = Math.min(stats.weeklyCount / stats.weeklyTarget, 1) * 100;
      const streakPct = Math.min(stats.streak / streakCapDays, 1) * 100;
      const score = stepWeight * stepPct + streakWeight * streakPct + gymWeight * gymPct;
      return { user, ...stats, stepPct, gymPct, score };
    })
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.user.name.localeCompare(b.user.name));
}

/**
 * Weighted score (steps/streak/gym — admin-tunable via getAppConfig) for a clan's members over an
 * arbitrary window. The live manage page passes the current week (window.end left undefined, so
 * it defaults to now); the weekly recap cron job passes last week's exact {start, end}.
 */
export async function computeLeaderboard(
  members: ClanMember[],
  config: LeaderboardConfig,
  stepsGoals: Map<string, number>,
  gymGoals: Map<string, number>,
  window: { start: Date; end?: Date },
): Promise<LeaderboardEntry[]> {
  const memberIds = members.map((m) => m.user.id);
  const dailyStepTargets = new Map(
    memberIds.map((id) => [id, stepsGoals.get(id) ?? config.defaultDailyStepsTarget]),
  );

  const [weeklyCounts, weeklyStepsTotals, streaks] = await Promise.all([
    getWeeklyCounts(memberIds, "gym", window),
    getWeeklyStepsTotals(memberIds, window),
    getStepGoalStreaks(memberIds, dailyStepTargets, window.end ?? new Date()),
  ]);

  const statsByUser = new Map<string, MemberStats>(
    memberIds.map((id) => [
      id,
      {
        weeklyCount: weeklyCounts.get(id) ?? 0,
        weeklyTarget: gymGoals.get(id) ?? config.defaultWeeklyGymTarget,
        weeklySteps: weeklyStepsTotals.get(id) ?? 0,
        weeklyStepsTarget: (stepsGoals.get(id) ?? config.defaultDailyStepsTarget) * 7,
        streak: streaks.get(id) ?? 0,
      },
    ]),
  );

  return scoreMembers(members, config, statsByUser);
}
