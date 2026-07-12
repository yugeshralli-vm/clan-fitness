import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reactions, users } from "@/db/schema";
import type { ReactionSummary } from "./types";

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
