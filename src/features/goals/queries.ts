import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { goals } from "@/db/schema";
import type { GoalType } from "./types";

// Cached per-request: both the (app) layout's onboarding gate and individual pages
// (Logs, Profile) call this with the same userId in the same render pass.
export const getUserGoals = cache(async (userId: string) => {
  return db.select().from(goals).where(eq(goals.userId, userId));
});

export async function getUserGoal(userId: string, type: GoalType) {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.type, type)));
  return goal ?? null;
}

export async function getGoalsForUsers(userIds: string[], type: GoalType) {
  const targets = new Map<string, number>();
  if (userIds.length === 0) return targets;

  const rows = await db
    .select({ userId: goals.userId, targetValue: goals.targetValue })
    .from(goals)
    .where(and(inArray(goals.userId, userIds), eq(goals.type, type)));

  for (const row of rows) targets.set(row.userId, row.targetValue);
  return targets;
}
