import "server-only";

import { getUserStreak } from "@/features/check-ins/queries";
import {
  getAllTimeBestStepsBefore,
  getDistinctReactionTargetOwners,
  getStepsAverageBefore,
  getStepsInWindow,
  hasAllThreeCategories,
  hasCheckInInWindow,
  hasCommentedOnOthersCheckIn,
  hasFullFoodStatus,
  hasFoodPhoto,
  hasSentChatMessage,
  isUnusualGymDay,
  wasFirstToCheckInInClan,
} from "./eval-helpers";
import type { ContractDefinition } from "./types";

/** Fixed stake for the wager contract — not user-chosen, to keep the claim flow a single
 * confirm tap rather than needing an amount picker. */
export const WAGER_STAKE = 20;

// Contracts evaluate against the CLAN's shared day window (ctx.dayStart/dayEnd, Asia/Kolkata),
// not each member's own timezone — the board is a shared, clan-wide concept with one canonical
// day boundary (see clan-contracts' claim-lock), so evaluation follows the same reference frame
// rather than mixing in per-member local days.
export const CONTRACT_CATALOG: ContractDefinition[] = [
  // ---------- Tier 1 — 10pts ----------
  {
    id: "log-any-checkin",
    tier: 1,
    points: 10,
    title: "Show up",
    description: "Log any check-in today — gym, steps, or food.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await hasCheckInInWindow(userId, ["gym", "steps", "food"], dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "keep-streak",
    tier: 1,
    points: 10,
    title: "Keep it going",
    description: "Log your gym check-in today to keep your streak alive.",
    async evaluate({ userId }) {
      // getUserStreak walks backward from "now" — the resolution cron runs shortly after the
      // clan day ends, so a streak of >=1 here means that day's gym check-in is what's keeping
      // it alive.
      const streak = await getUserStreak(userId, "gym", "Asia/Kolkata");
      const completed = streak >= 1;
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "log-thought",
    tier: 1,
    points: 10,
    title: "Share a thought",
    description: "Log a daily thought.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await hasCheckInInWindow(userId, ["thought"], dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "react-to-someone",
    tier: 1,
    points: 10,
    title: "Show some love",
    description: "React to a clanmate's check-in or chat message.",
    async evaluate({ userId, clanId, dayStart, dayEnd }) {
      const owners = await getDistinctReactionTargetOwners(userId, clanId, dayStart, dayEnd);
      const completed = owners.size >= 1;
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "comment-on-checkin",
    tier: 1,
    points: 10,
    title: "Say something",
    description: "Comment on someone else's check-in.",
    async evaluate({ userId, clanId, dayStart, dayEnd }) {
      const completed = await hasCommentedOnOthersCheckIn(userId, clanId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "send-chat-message",
    tier: 1,
    points: 10,
    title: "Say hi",
    description: "Send a message in clan chat.",
    async evaluate({ userId, clanId, dayStart, dayEnd }) {
      const completed = await hasSentChatMessage(userId, clanId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },
  {
    id: "checkin-with-photo",
    tier: 1,
    points: 10,
    title: "Picture proof",
    description: "Check in with a photo attached.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await hasFoodPhoto(userId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 10 : 0 };
    },
  },

  // ---------- Tier 2 — 30-50pts ----------
  {
    id: "beat-own-avg-steps",
    tier: 2,
    points: 40,
    title: "Beat your average",
    description: "Beat your own 7-day step average today.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const [today, average] = await Promise.all([getStepsInWindow(userId, dayStart, dayEnd), getStepsAverageBefore(userId, dayStart)]);
      const completed = average > 0 && today > average;
      return { completed, pointsAwarded: completed ? 40 : 0 };
    },
    async getTarget({ userId, dayStart }) {
      const average = await getStepsAverageBefore(userId, dayStart);
      return average > 0 ? Math.floor(average) + 1 : null;
    },
  },
  {
    id: "perfect-day",
    tier: 2,
    points: 50,
    title: "Perfect day",
    description: "Log gym, steps, and food — all in one day.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await hasAllThreeCategories(userId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 50 : 0 };
    },
  },
  {
    id: "steps-10k",
    tier: 2,
    points: 50,
    title: "10k steps",
    description: "Hit 10,000 steps today.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const today = await getStepsInWindow(userId, dayStart, dayEnd);
      const completed = today >= 10_000;
      return { completed, pointsAwarded: completed ? 50 : 0 };
    },
  },
  {
    id: "duel-win",
    tier: 2,
    points: 40,
    title: "Duel",
    description: "Beat your randomly-assigned daily rival's steps.",
    needsOpponent: true,
    async evaluate({ userId, dayStart, dayEnd, meta }) {
      const opponentId = meta?.opponentUserId as string | undefined;
      if (!opponentId) return { completed: false, pointsAwarded: 0 };
      const [mine, theirs] = await Promise.all([
        getStepsInWindow(userId, dayStart, dayEnd),
        getStepsInWindow(opponentId, dayStart, dayEnd),
      ]);
      const completed = mine > theirs;
      return { completed, pointsAwarded: completed ? 40 : 0 };
    },
  },
  {
    id: "unusual-gym-day",
    tier: 2,
    points: 40,
    title: "Break the pattern",
    description: "Log gym on a day you'd normally skip.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await isUnusualGymDay(userId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 40 : 0 };
    },
  },
  {
    id: "react-to-three",
    tier: 2,
    points: 30,
    title: "Spread it around",
    description: "React to 3 different clanmates today.",
    async evaluate({ userId, clanId, dayStart, dayEnd }) {
      const owners = await getDistinctReactionTargetOwners(userId, clanId, dayStart, dayEnd);
      const completed = owners.size >= 3;
      return { completed, pointsAwarded: completed ? 30 : 0 };
    },
  },
  {
    id: "all-three-meals",
    tier: 2,
    points: 30,
    title: "Ate well",
    description: "Log a full \"yes\" on your food check-in today.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const completed = await hasFullFoodStatus(userId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 30 : 0 };
    },
  },
  {
    id: "first-to-checkin",
    tier: 2,
    points: 30,
    title: "First one in",
    description: "Be the first clan member to check in today.",
    async evaluate({ userId, clanId, dayStart, dayEnd }) {
      const completed = await wasFirstToCheckInInClan(userId, clanId, dayStart, dayEnd);
      return { completed, pointsAwarded: completed ? 30 : 0 };
    },
  },

  // ---------- Tier 3 — 100-150pts, single-day, near-impossible ----------
  {
    id: "beat-personal-best-steps",
    tier: 3,
    points: 150,
    title: "New record",
    description: "Beat your all-time single-day step count.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const [today, best] = await Promise.all([getStepsInWindow(userId, dayStart, dayEnd), getAllTimeBestStepsBefore(userId, dayStart)]);
      const completed = best > 0 && today > best;
      return { completed, pointsAwarded: completed ? 150 : 0 };
    },
    async getTarget({ userId, dayStart }) {
      const best = await getAllTimeBestStepsBefore(userId, dayStart);
      return best > 0 ? best + 1 : null;
    },
  },
  {
    id: "double-avg-steps",
    tier: 3,
    points: 120,
    title: "Double up",
    description: "Double your 7-day step average today.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const [today, average] = await Promise.all([getStepsInWindow(userId, dayStart, dayEnd), getStepsAverageBefore(userId, dayStart)]);
      const completed = average > 0 && today >= average * 2;
      return { completed, pointsAwarded: completed ? 120 : 0 };
    },
    async getTarget({ userId, dayStart }) {
      const average = await getStepsAverageBefore(userId, dayStart);
      return average > 0 ? Math.ceil(average * 2) : null;
    },
  },
  {
    id: "wager-double-avg",
    tier: 3,
    points: 150,
    title: "All in",
    description: `Stake ${WAGER_STAKE} points that you'll double your daily average steps today — double your average and win big, miss it and lose the stake.`,
    isWager: true,
    async evaluate({ userId, dayStart, dayEnd, meta }) {
      const stake = (meta?.stake as number | undefined) ?? WAGER_STAKE;
      const [today, average] = await Promise.all([getStepsInWindow(userId, dayStart, dayEnd), getStepsAverageBefore(userId, dayStart)]);
      const completed = average > 0 && today >= average * 2;
      return { completed, pointsAwarded: completed ? 150 : -stake };
    },
    async getTarget({ userId, dayStart }) {
      const average = await getStepsAverageBefore(userId, dayStart);
      return average > 0 ? Math.ceil(average * 2) : null;
    },
  },
  {
    id: "duel-landslide",
    tier: 3,
    points: 120,
    title: "Landslide",
    description: "Beat your rival's steps by 2x today.",
    needsOpponent: true,
    async evaluate({ userId, dayStart, dayEnd, meta }) {
      const opponentId = meta?.opponentUserId as string | undefined;
      if (!opponentId) return { completed: false, pointsAwarded: 0 };
      const [mine, theirs] = await Promise.all([
        getStepsInWindow(userId, dayStart, dayEnd),
        getStepsInWindow(opponentId, dayStart, dayEnd),
      ]);
      const completed = theirs > 0 ? mine >= theirs * 2 : mine > 0;
      return { completed, pointsAwarded: completed ? 120 : 0 };
    },
  },
  {
    id: "perfect-day-elevated",
    tier: 3,
    points: 150,
    title: "Perfect day, elevated",
    description: "Log gym, steps, and food, and beat your own 7-day step average — all in one day.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const [perfectDay, today, average] = await Promise.all([
        hasAllThreeCategories(userId, dayStart, dayEnd),
        getStepsInWindow(userId, dayStart, dayEnd),
        getStepsAverageBefore(userId, dayStart),
      ]);
      const completed = perfectDay && average > 0 && today > average;
      return { completed, pointsAwarded: completed ? 150 : 0 };
    },
    async getTarget({ userId, dayStart }) {
      const average = await getStepsAverageBefore(userId, dayStart);
      return average > 0 ? Math.floor(average) + 1 : null;
    },
  },
  {
    id: "steps-20k",
    tier: 3,
    points: 100,
    title: "20k steps",
    description: "Hit 20,000 steps today.",
    async evaluate({ userId, dayStart, dayEnd }) {
      const today = await getStepsInWindow(userId, dayStart, dayEnd);
      const completed = today >= 20_000;
      return { completed, pointsAwarded: completed ? 100 : 0 };
    },
  },
];

export function getContract(contractId: string): ContractDefinition | undefined {
  return CONTRACT_CATALOG.find((contract) => contract.id === contractId);
}
