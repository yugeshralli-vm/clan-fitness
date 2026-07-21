import "server-only";

import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, clanMessages, comments, reactions } from "@/db/schema";
import { getClanMembers } from "@/features/clans/queries";
import { getFoodPhotoUrls } from "@/features/check-ins/types";
import type { FoodCheckInValue, StepsCheckInValue } from "@/features/check-ins/types";

/** Sum of steps logged in [start, end) — realistically at most one row, but summed defensively. */
export async function getStepsInWindow(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ value: checkIns.value })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "steps"), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)));
  return rows.reduce((sum, row) => sum + (row.value as StepsCheckInValue).count, 0);
}

/** Average daily steps over the `days` before `end` — divided by the fixed window length, not the
 * number of days actually logged, so a missed day counts as 0 rather than being excluded (otherwise
 * one big day in an otherwise-empty week would inflate the "average" and make it trivial to beat). */
export async function getStepsAverageBefore(userId: string, end: Date, days = 7): Promise<number> {
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ value: checkIns.value })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "steps"), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)));
  const total = rows.reduce((sum, row) => sum + (row.value as StepsCheckInValue).count, 0);
  return total / days;
}

/** Best single-day step count logged strictly before `before` (excludes the day being evaluated,
 * so a contract can compare "today" against a genuine prior personal best). */
export async function getAllTimeBestStepsBefore(userId: string, before: Date): Promise<number> {
  const rows = await db
    .select({ value: checkIns.value })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "steps"), lt(checkIns.createdAt, before)));
  return rows.reduce((max, row) => Math.max(max, (row.value as StepsCheckInValue).count), 0);
}

export async function hasCheckInInWindow(userId: string, types: ("gym" | "steps" | "food" | "thought")[], start: Date, end: Date) {
  const rows = await db
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), inArray(checkIns.type, types), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)))
    .limit(1);
  return rows.length > 0;
}

export async function hasAllThreeCategories(userId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db
    .select({ type: checkIns.type })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), inArray(checkIns.type, ["gym", "steps", "food"]), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)));
  const types = new Set(rows.map((row) => row.type));
  return types.has("gym") && types.has("steps") && types.has("food");
}

/** "Ate well all day" — the food check-in's yes/no/partial status is the closest thing this app's
 * schema has to a per-meal breakdown; "yes" is treated as the full-marks answer. */
export async function hasFullFoodStatus(userId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db
    .select({ value: checkIns.value })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "food"), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)));
  return rows.some((row) => (row.value as FoodCheckInValue).status === "yes");
}

export async function hasFoodPhoto(userId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db
    .select({ value: checkIns.value })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "food"), gte(checkIns.createdAt, start), lt(checkIns.createdAt, end)));
  return rows.some((row) => getFoodPhotoUrls(row.value as FoodCheckInValue).length > 0);
}

export async function wasFirstToCheckInInClan(userId: string, clanId: string, start: Date, end: Date): Promise<boolean> {
  const members = await getClanMembers(clanId);
  const memberIds = members.map((m) => m.user.id);
  if (memberIds.length === 0) return false;

  // "thought" is an optional journal-style entry, not a real activity log (see hasCheckInInWindow's
  // callers) — excluded here too, so logging only a thought can't win the "first one in" race.
  const [first] = await db
    .select({ userId: checkIns.userId, createdAt: checkIns.createdAt })
    .from(checkIns)
    .where(
      and(
        inArray(checkIns.userId, memberIds),
        inArray(checkIns.type, ["gym", "steps", "food"]),
        gte(checkIns.createdAt, start),
        lt(checkIns.createdAt, end),
      ),
    )
    .orderBy(asc(checkIns.createdAt))
    .limit(1);

  return first?.userId === userId;
}

/** Distinct clanmates (excluding self) this user reacted to within the window — covers both the
 * "react to someone" and "react to 3 different clanmates" contracts with one query. */
export async function getDistinctReactionTargetOwners(
  userId: string,
  clanId: string,
  start: Date,
  end: Date,
): Promise<Set<string>> {
  const rows = await db
    .select({ checkInId: reactions.checkInId, clanMessageId: reactions.clanMessageId })
    .from(reactions)
    .where(and(eq(reactions.userId, userId), eq(reactions.clanId, clanId), gte(reactions.createdAt, start), lt(reactions.createdAt, end)));
  if (rows.length === 0) return new Set();

  const checkInIds = rows.map((row) => row.checkInId).filter((id): id is string => id !== null);
  const messageIds = rows.map((row) => row.clanMessageId).filter((id): id is string => id !== null);

  const [checkInOwners, messageOwners] = await Promise.all([
    checkInIds.length
      ? db.select({ id: checkIns.id, userId: checkIns.userId }).from(checkIns).where(inArray(checkIns.id, checkInIds))
      : Promise.resolve([]),
    messageIds.length
      ? db.select({ id: clanMessages.id, userId: clanMessages.userId }).from(clanMessages).where(inArray(clanMessages.id, messageIds))
      : Promise.resolve([]),
  ]);
  const ownerById = new Map([...checkInOwners, ...messageOwners].map((owner) => [owner.id, owner.userId]));

  const others = new Set<string>();
  for (const row of rows) {
    const targetId = row.checkInId ?? row.clanMessageId;
    const owner = targetId ? ownerById.get(targetId) : undefined;
    if (owner && owner !== userId) others.add(owner);
  }
  return others;
}

export async function hasCommentedOnOthersCheckIn(userId: string, clanId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db
    .select({ checkInId: comments.checkInId })
    .from(comments)
    .where(and(eq(comments.userId, userId), eq(comments.clanId, clanId), gte(comments.createdAt, start), lt(comments.createdAt, end)));
  const checkInIds = rows.map((row) => row.checkInId).filter((id): id is string => id !== null);
  if (checkInIds.length === 0) return false;

  const owners = await db.select({ id: checkIns.id, userId: checkIns.userId }).from(checkIns).where(inArray(checkIns.id, checkInIds));
  const ownerById = new Map(owners.map((owner) => [owner.id, owner.userId]));
  return checkInIds.some((id) => ownerById.get(id) !== userId);
}

export async function hasSentChatMessage(userId: string, clanId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db
    .select({ id: clanMessages.id })
    .from(clanMessages)
    .where(and(eq(clanMessages.userId, userId), eq(clanMessages.clanId, clanId), gte(clanMessages.createdAt, start), lt(clanMessages.createdAt, end)))
    .limit(1);
  return rows.length > 0;
}

/** Heuristic for "log gym on a day you'd normally skip": true if gym was logged today AND this
 * calendar weekday's historical gym rate (trailing 8 weeks) is below 40% — an illustrative
 * threshold, not admin-tunable yet; revisit once real logging patterns can be sanity-checked. */
export async function isUnusualGymDay(userId: string, dayStart: Date, dayEnd: Date): Promise<boolean> {
  const loggedToday = await hasCheckInInWindow(userId, ["gym"], dayStart, dayEnd);
  if (!loggedToday) return false;

  const lookbackWeeks = 8;
  const lookbackStart = new Date(dayStart.getTime() - lookbackWeeks * 7 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ createdAt: checkIns.createdAt })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, "gym"), gte(checkIns.createdAt, lookbackStart), lt(checkIns.createdAt, dayStart)));

  // Adding 12h before reading getUTCDay() keeps the weekday read stable for any timezone offset
  // under 12h (Asia/Kolkata is +5:30) — dayStart itself is the UTC instant of local midnight, so
  // reading its own getUTCDay() directly would be off by one for a positive offset.
  const todayDow = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000).getUTCDay();
  const matchingDays = rows.filter((row) => new Date(row.createdAt.getTime() + 12 * 60 * 60 * 1000).getUTCDay() === todayDow).length;
  const historicalRate = matchingDays / lookbackWeeks;

  return historicalRate < 0.4;
}
