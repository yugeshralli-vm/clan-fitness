import "server-only";

import { getAppConfig } from "@/features/admin";
import { computeLeaderboard } from "@/features/check-ins";
import { getClanMembers } from "@/features/clans";
import { getGoalsForUsers } from "@/features/goals";
import { db } from "@/db";
import { systemPosts } from "@/db/schema";

const MIN_ELIGIBLE_MEMBERS = 2;

function truncateToDay(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Computes and inserts a clan's weekly Top 3 / Wall of Shame recap for the given (already-ended)
 * week, or returns null without inserting anything if the clan doesn't have enough eligible
 * members. Idempotent via the unique (clanId, type, weekStart) index — safe to call twice for the
 * same week.
 */
export async function generateWeeklyRecap(clanId: string, window: { start: Date; end: Date }) {
  const [members, config] = await Promise.all([getClanMembers(clanId), getAppConfig()]);

  // Eligible = already a member by the end of the window being summarized — mirrors getClanFeed's
  // own membership-visibility rule (day-truncated joinedAt), so someone who joined *this* week
  // (before the cron fires) isn't scored on a week they weren't part of.
  const weekEndDay = truncateToDay(window.end);
  const eligibleMembers = members.filter((member) => truncateToDay(member.joinedAt) <= weekEndDay);
  if (eligibleMembers.length < MIN_ELIGIBLE_MEMBERS) return null;

  const memberIds = eligibleMembers.map((member) => member.user.id);
  const [stepsGoals, gymGoals] = await Promise.all([
    getGoalsForUsers(memberIds, "steps"),
    getGoalsForUsers(memberIds, "gym"),
  ]);

  // Already sorted score desc, then streak desc, then name asc — same tie-break as the live
  // leaderboard, so Top 3 is just this array's head and Wall of Shame is its tail.
  const ranked = await computeLeaderboard(eligibleMembers, config, stepsGoals, gymGoals, window, 7);

  const topThree = ranked.filter((entry) => entry.score > 0).slice(0, 3);
  const topThreeIds = new Set(topThree.map((entry) => entry.user.id));

  const remainder = ranked.filter((entry) => !topThreeIds.has(entry.user.id));
  const wallOfShameCandidates = remainder.slice(-3).reverse(); // worst-first
  // A wall of shame that's entirely zero-scorers is just an arbitrary alphabetical pick among
  // ties, not real signal — omit it rather than "shame" people for tied inactivity (symmetric with
  // Top 3's own score > 0 gate above).
  const wallOfShame =
    wallOfShameCandidates.length > 0 && wallOfShameCandidates.every((entry) => entry.score === 0)
      ? []
      : wallOfShameCandidates;

  if (topThree.length === 0 && wallOfShame.length === 0) return null;

  const [row] = await db
    .insert(systemPosts)
    .values({
      clanId,
      type: "weekly_recap",
      weekStart: window.start,
      weekEnd: window.end,
      topThree: topThree.map((entry) => ({ userId: entry.user.id, score: entry.score })),
      wallOfShame: wallOfShame.map((entry) => ({ userId: entry.user.id, score: entry.score })),
    })
    .onConflictDoNothing({ target: [systemPosts.clanId, systemPosts.type, systemPosts.weekStart] })
    .returning();

  return row ?? null;
}
