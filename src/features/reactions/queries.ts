import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reactions, users } from "@/db/schema";
import type { ReactionSummary } from "./types";

/**
 * Count-only variant of getReactionsForCheckIns for the mobile feed API, which shows a bare count
 * badge (no reactor names/avatars, no per-emoji breakdown) rather than the full reactor list web's
 * ReactionBar needs — avoids shipping every reactor's identity over a mobile network just to
 * discard everything but the total.
 */
export async function getReactionCountsForCheckIns(
  checkInIds: string[],
  clanId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (checkInIds.length === 0) return counts;

  const rows = await db
    .select({ checkInId: reactions.checkInId, count: count() })
    .from(reactions)
    .where(and(inArray(reactions.checkInId, checkInIds), eq(reactions.clanId, clanId)))
    .groupBy(reactions.checkInId);

  for (const row of rows) {
    if (!row.checkInId) continue;
    counts[row.checkInId] = row.count;
  }
  return counts;
}

export async function getReactionsForCheckIns(
  checkInIds: string[],
  clanId: string,
  currentUserId: string,
): Promise<Record<string, ReactionSummary>> {
  const summaries: Record<string, ReactionSummary> = {};
  if (checkInIds.length === 0) return summaries;

  const rows = await db
    .select({
      checkInId: reactions.checkInId,
      emoji: reactions.emoji,
      userId: reactions.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(reactions)
    .innerJoin(users, eq(reactions.userId, users.id))
    .where(and(inArray(reactions.checkInId, checkInIds), eq(reactions.clanId, clanId)));

  for (const row of rows) {
    if (!row.checkInId) continue; // narrows the column — always non-null for this query's own rows
    const summary = (summaries[row.checkInId] ??= {});
    const entry = (summary[row.emoji] ??= { reactedByMe: false, users: [] });
    entry.users.push({ id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl });
    if (row.userId === currentUserId) entry.reactedByMe = true;
  }

  return summaries;
}

export async function getReactionsForSystemPosts(
  systemPostIds: string[],
  clanId: string,
  currentUserId: string,
): Promise<Record<string, ReactionSummary>> {
  const summaries: Record<string, ReactionSummary> = {};
  if (systemPostIds.length === 0) return summaries;

  const rows = await db
    .select({
      systemPostId: reactions.systemPostId,
      emoji: reactions.emoji,
      userId: reactions.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(reactions)
    .innerJoin(users, eq(reactions.userId, users.id))
    .where(and(inArray(reactions.systemPostId, systemPostIds), eq(reactions.clanId, clanId)));

  for (const row of rows) {
    if (!row.systemPostId) continue; // narrows the column — always non-null for this query's own rows
    const summary = (summaries[row.systemPostId] ??= {});
    const entry = (summary[row.emoji] ??= { reactedByMe: false, users: [] });
    entry.users.push({ id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl });
    if (row.userId === currentUserId) entry.reactedByMe = true;
  }

  return summaries;
}

export async function getReactionsForClanMessages(
  clanMessageIds: string[],
  clanId: string,
  currentUserId: string,
): Promise<Record<string, ReactionSummary>> {
  const summaries: Record<string, ReactionSummary> = {};
  if (clanMessageIds.length === 0) return summaries;

  const rows = await db
    .select({
      clanMessageId: reactions.clanMessageId,
      emoji: reactions.emoji,
      userId: reactions.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(reactions)
    .innerJoin(users, eq(reactions.userId, users.id))
    .where(and(inArray(reactions.clanMessageId, clanMessageIds), eq(reactions.clanId, clanId)));

  for (const row of rows) {
    if (!row.clanMessageId) continue; // narrows the column — always non-null for this query's own rows
    const summary = (summaries[row.clanMessageId] ??= {});
    const entry = (summary[row.emoji] ??= { reactedByMe: false, users: [] });
    entry.users.push({ id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl });
    if (row.userId === currentUserId) entry.reactedByMe = true;
  }

  return summaries;
}
