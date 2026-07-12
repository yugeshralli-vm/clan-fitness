import "server-only";

import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { checkIns, clanMemberships, users } from "@/db/schema";
import type { CheckInType, StepsCheckInValue } from "./types";

export const FEED_PAGE_SIZE = 20;

function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function startOfToday() {
  return startOfDay();
}

// Sunday 08:00 IST (=02:30 UTC) — the app's week boundary. IST has no DST, so this fixed UTC
// offset is safe year-round. Returns the most recent such instant at or before `now`.
export function startOfWeek(now = new Date()) {
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 30, 0, 0),
  );
  candidate.setUTCDate(candidate.getUTCDate() - candidate.getUTCDay()); // this-or-last Sunday
  if (candidate.getTime() > now.getTime()) candidate.setUTCDate(candidate.getUTCDate() - 7); // hasn't crossed yet today
  return candidate;
}

export function startOfMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

// A check-in has no clanId of its own — it's visible in a clan's feed whenever its author is
// (still) a member of that clan and it was logged from the day they joined onward. Compares
// against the start of joinedAt's calendar day, not the exact joinedAt instant: otherwise a
// check-in logged earlier the same day someone joins (a common case — log first thing, join a
// clan later) would be wrongly excluded, since its createdAt would fall before the precise
// joinedAt timestamp despite being the same day. No row-fanout risk: the unique (userId, clanId)
// index on clanMemberships means at most one membership row matches per checkIns.userId for a
// fixed clanId filter.
export async function getClanFeed(clanId: string, before?: Date) {
  const conditions = [
    eq(clanMemberships.clanId, clanId),
    eq(checkIns.visibility, "public_to_clan"),
    gte(checkIns.createdAt, sql`date_trunc('day', ${clanMemberships.joinedAt})`),
  ];
  if (before) conditions.push(lt(checkIns.createdAt, before));

  return db
    .select({ checkIn: checkIns, user: users })
    .from(checkIns)
    .innerJoin(clanMemberships, eq(checkIns.userId, clanMemberships.userId))
    .innerJoin(users, eq(checkIns.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(checkIns.createdAt))
    .limit(FEED_PAGE_SIZE);
}

export type FeedRow = Awaited<ReturnType<typeof getClanFeed>>[number];

/** Looked up only for its `createdAt`, to anchor a feed page around it — clan-visibility is enforced by getClanFeed's own join, not here. */
export async function getCheckInById(checkInId: string) {
  const [row] = await db.select({ id: checkIns.id, createdAt: checkIns.createdAt }).from(checkIns).where(eq(checkIns.id, checkInId));
  return row ?? null;
}

export async function getLatestCheckInAt(clanId: string, excludeUserId?: string) {
  const conditions = [
    eq(clanMemberships.clanId, clanId),
    eq(checkIns.visibility, "public_to_clan"),
    gte(checkIns.createdAt, sql`date_trunc('day', ${clanMemberships.joinedAt})`),
  ];
  if (excludeUserId) conditions.push(ne(checkIns.userId, excludeUserId));

  const [row] = await db
    .select({ createdAt: checkIns.createdAt })
    .from(checkIns)
    .innerJoin(clanMemberships, eq(checkIns.userId, clanMemberships.userId))
    .where(and(...conditions))
    .orderBy(desc(checkIns.createdAt))
    .limit(1);

  return row?.createdAt ?? null;
}

export async function getUsersLoggedToday(userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();

  const rows = await db
    .selectDistinct({ userId: checkIns.userId })
    .from(checkIns)
    .where(and(inArray(checkIns.userId, userIds), gte(checkIns.createdAt, startOfToday())));

  return new Set(rows.map((row) => row.userId));
}

export async function getTodaysCheckIn(userId: string, type: CheckInType) {
  const [existing] = await db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, type), gte(checkIns.createdAt, startOfToday())));
  return existing ?? null;
}

export async function getUserWeeklyCount(userId: string, type: CheckInType) {
  const rows = await db
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, type), gte(checkIns.createdAt, startOfWeek())));
  return rows.length;
}

export type DateWindow = { start: Date; end?: Date };

export async function getWeeklyCounts(userIds: string[], type: CheckInType, { start, end = new Date() }: DateWindow) {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;

  const rows = await db
    .select({ userId: checkIns.userId })
    .from(checkIns)
    .where(
      and(
        inArray(checkIns.userId, userIds),
        eq(checkIns.type, type),
        gte(checkIns.createdAt, start),
        lt(checkIns.createdAt, end),
      ),
    );

  for (const row of rows) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  return counts;
}

export async function getWeeklyStepsTotals(userIds: string[], { start, end = new Date() }: DateWindow) {
  const totals = new Map<string, number>();
  if (userIds.length === 0) return totals;

  const rows = await db
    .select({ userId: checkIns.userId, value: checkIns.value })
    .from(checkIns)
    .where(
      and(
        inArray(checkIns.userId, userIds),
        eq(checkIns.type, "steps"),
        gte(checkIns.createdAt, start),
        lt(checkIns.createdAt, end),
      ),
    );

  for (const row of rows) {
    const { count } = row.value as StepsCheckInValue;
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + count);
  }
  return totals;
}

// asOf anchors the cursor's starting day — defaults to today so existing callers (streak "as of
// now") are unaffected. Callers computing a past week's streak (see getStepGoalStreaks) pass the
// end of that week instead, so the walk-backward never considers days beyond it.
function streakFromDayKeys(dayKeys: Set<string>, asOf: Date = new Date()) {
  const cursor = startOfDay(asOf);
  if (!dayKeys.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getUserStreak(userId: string, type: CheckInType) {
  const rows = await db
    .select({ createdAt: checkIns.createdAt })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.type, type)));

  return streakFromDayKeys(new Set(rows.map((row) => row.createdAt.toISOString().slice(0, 10))));
}

export async function getStreaks(userIds: string[], type: CheckInType) {
  const streaks = new Map<string, number>();
  if (userIds.length === 0) return streaks;

  const rows = await db
    .select({ userId: checkIns.userId, createdAt: checkIns.createdAt })
    .from(checkIns)
    .where(and(inArray(checkIns.userId, userIds), eq(checkIns.type, type)));

  const dayKeysByUser = new Map<string, Set<string>>();
  for (const row of rows) {
    const dayKeys = dayKeysByUser.get(row.userId) ?? new Set<string>();
    dayKeys.add(row.createdAt.toISOString().slice(0, 10));
    dayKeysByUser.set(row.userId, dayKeys);
  }

  for (const userId of userIds) {
    streaks.set(userId, streakFromDayKeys(dayKeysByUser.get(userId) ?? new Set()));
  }
  return streaks;
}

// Like getStreaks, but a day only counts if that day's steps met the user's daily target —
// logging a check-in isn't enough on its own. dailyTargetsByUser must already have a default
// filled in per user; this function doesn't know about any fallback target. asOf bounds the rows
// to createdAt < asOf AND seeds the streak walk there (both are required together — otherwise a
// check-in logged just after asOf, on the same UTC calendar day, would wrongly count toward a
// streak computed "as of" that day).
export async function getStepGoalStreaks(
  userIds: string[],
  dailyTargetsByUser: Map<string, number>,
  asOf: Date = new Date(),
) {
  const streaks = new Map<string, number>();
  if (userIds.length === 0) return streaks;

  const rows = await db
    .select({ userId: checkIns.userId, createdAt: checkIns.createdAt, value: checkIns.value })
    .from(checkIns)
    .where(and(inArray(checkIns.userId, userIds), eq(checkIns.type, "steps"), lt(checkIns.createdAt, asOf)));

  const dayKeysByUser = new Map<string, Set<string>>();
  for (const row of rows) {
    const { count } = row.value as StepsCheckInValue;
    if (count < (dailyTargetsByUser.get(row.userId) ?? Infinity)) continue;
    const dayKeys = dayKeysByUser.get(row.userId) ?? new Set<string>();
    dayKeys.add(row.createdAt.toISOString().slice(0, 10));
    dayKeysByUser.set(row.userId, dayKeys);
  }

  for (const userId of userIds) {
    streaks.set(userId, streakFromDayKeys(dayKeysByUser.get(userId) ?? new Set(), asOf));
  }
  return streaks;
}
