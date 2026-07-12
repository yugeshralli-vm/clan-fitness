import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { systemPosts, users } from "@/db/schema";

export type SystemPostRankedEntry = { userId: string; score: number; name: string; avatarUrl: string | null };

export type SystemPostForFeed = {
  id: string;
  clanId: string;
  weekStart: Date;
  weekEnd: Date;
  createdAt: Date;
  topThree: SystemPostRankedEntry[];
  wallOfShame: SystemPostRankedEntry[];
};

/**
 * Every system post for a clan, newest first. There's at most one per week (see the unique index
 * on systemPosts), so even a multi-year-old clan is a tiny result set — no pagination needed,
 * unlike getClanFeed. Resolves each entry's name/avatar via a live join to `users` (only {userId,
 * score} is stored on the row itself) rather than a snapshot, since users are never deleted here.
 */
export async function getSystemPostsForClan(clanId: string): Promise<SystemPostForFeed[]> {
  const rows = await db
    .select()
    .from(systemPosts)
    .where(eq(systemPosts.clanId, clanId))
    .orderBy(desc(systemPosts.createdAt));
  if (rows.length === 0) return [];

  const userIds = new Set<string>();
  for (const row of rows) {
    for (const entry of row.topThree) userIds.add(entry.userId);
    for (const entry of row.wallOfShame) userIds.add(entry.userId);
  }

  const userRows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, [...userIds]));
  const userById = new Map(userRows.map((user) => [user.id, user]));

  function resolve(entries: { userId: string; score: number }[]): SystemPostRankedEntry[] {
    return entries.map((entry) => {
      const user = userById.get(entry.userId);
      return { userId: entry.userId, score: entry.score, name: user?.name ?? "Someone", avatarUrl: user?.avatarUrl ?? null };
    });
  }

  return rows.map((row) => ({
    id: row.id,
    clanId: row.clanId,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    createdAt: row.createdAt,
    topThree: resolve(row.topThree),
    wallOfShame: resolve(row.wallOfShame),
  }));
}
