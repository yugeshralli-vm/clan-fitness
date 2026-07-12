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
  periodCount: number;
  periodTarget: number;
  periodSteps: number;
  periodStepsTarget: number;
  streak: number;
  stepPct: number;
  gymPct: number;
  score: number;
};

type MemberStats = {
  periodCount: number;
  periodTarget: number;
  periodSteps: number;
  periodStepsTarget: number;
  streak: number;
};

// Pure so the weighted formula and tie-break are trivially eyeballed/tested in isolation from the
// DB — this is the one formula behind every leaderboard this app shows (the live manage-page tab,
// in any of its Today/Week/Month views, and the weekly Top 3/Wall of Shame recap).
function scoreMembers(
  members: ClanMember[],
  config: LeaderboardConfig,
  statsByUser: Map<string, MemberStats>,
): LeaderboardEntry[] {
  const { stepWeight, streakWeight, gymWeight, streakCapDays } = config;

  return members
    .map(({ user }) => {
      const stats = statsByUser.get(user.id)!;
      const stepPct = Math.min(stats.periodSteps / stats.periodStepsTarget, 1) * 100;
      const gymPct = Math.min(stats.periodCount / stats.periodTarget, 1) * 100;
      const streakPct = Math.min(stats.streak / streakCapDays, 1) * 100;
      const score = stepWeight * stepPct + streakWeight * streakPct + gymWeight * gymPct;
      return { user, ...stats, stepPct, gymPct, score };
    })
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.user.name.localeCompare(b.user.name));
}

/**
 * Weighted score (steps/streak/gym — admin-tunable via getAppConfig) for a clan's members over an
 * arbitrary window. `window` controls what actually gets counted ({start, end}, end defaulting to
 * now for a live/in-progress period). `periodLengthDays` is a *separate* concept: the full nominal
 * length of the period being scored against, used only to scale targets (daily steps target ×
 * periodLengthDays, weekly gym target × periodLengthDays/7). It's deliberately not derived from
 * `window.end - window.start` — for a live period `window.end` is "now", not the period's end, so
 * that difference is elapsed time, not the full period length. Using elapsed time would make e.g.
 * Monday's step count already read as ~100% of a same-day-prorated target, defeating the
 * "progress toward a goal that grows over the period" behavior this is supposed to show.
 * Callers: the live manage page passes today/this-week/this-month (1, 7, days-in-month); the
 * weekly recap cron job passes a completed week (7).
 */
export async function computeLeaderboard(
  members: ClanMember[],
  config: LeaderboardConfig,
  stepsGoals: Map<string, number>,
  gymGoals: Map<string, number>,
  window: { start: Date; end?: Date },
  periodLengthDays: number,
): Promise<LeaderboardEntry[]> {
  const memberIds = members.map((m) => m.user.id);
  const dailyStepTargets = new Map(
    memberIds.map((id) => [id, stepsGoals.get(id) ?? config.defaultDailyStepsTarget]),
  );

  const [periodCounts, periodStepsTotals, streaks] = await Promise.all([
    getWeeklyCounts(memberIds, "gym", window),
    getWeeklyStepsTotals(memberIds, window),
    getStepGoalStreaks(memberIds, dailyStepTargets, window.end ?? new Date()),
  ]);

  const statsByUser = new Map<string, MemberStats>(
    memberIds.map((id) => [
      id,
      {
        periodCount: periodCounts.get(id) ?? 0,
        periodTarget: (gymGoals.get(id) ?? config.defaultWeeklyGymTarget) * (periodLengthDays / 7),
        periodSteps: periodStepsTotals.get(id) ?? 0,
        periodStepsTarget: (stepsGoals.get(id) ?? config.defaultDailyStepsTarget) * periodLengthDays,
        streak: streaks.get(id) ?? 0,
      },
    ]),
  );

  return scoreMembers(members, config, statsByUser);
}
