import "server-only";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { comments, users } from "@/db/schema";

export type CommentWithUser = {
  id: string;
  checkInId: string | null;
  systemPostId: string | null;
  userId: string;
  text: string;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null };
};

export async function getCommentsForCheckIns(
  checkInIds: string[],
  clanId: string,
): Promise<Record<string, CommentWithUser[]>> {
  const grouped: Record<string, CommentWithUser[]> = {};
  if (checkInIds.length === 0) return grouped;

  const rows = await db
    .select({ comment: comments, user: users })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(inArray(comments.checkInId, checkInIds), eq(comments.clanId, clanId)))
    .orderBy(asc(comments.createdAt));

  for (const { comment, user } of rows) {
    if (!comment.checkInId) continue; // narrows the column — always non-null for this query's own rows
    (grouped[comment.checkInId] ??= []).push({
      id: comment.id,
      checkInId: comment.checkInId,
      systemPostId: comment.systemPostId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    });
  }
  return grouped;
}

/**
 * Count-only variant of getCommentsForCheckIns for the mobile feed API, which shows a bare count
 * badge (no comment bodies) rather than the full thread web loads up front — avoids shipping every
 * comment's text/author over a mobile network just to discard everything but `.length`.
 */
export async function getCommentCountsForCheckIns(
  checkInIds: string[],
  clanId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (checkInIds.length === 0) return counts;

  const rows = await db
    .select({ checkInId: comments.checkInId, count: count() })
    .from(comments)
    .where(and(inArray(comments.checkInId, checkInIds), eq(comments.clanId, clanId)))
    .groupBy(comments.checkInId);

  for (const row of rows) {
    if (!row.checkInId) continue;
    counts[row.checkInId] = row.count;
  }
  return counts;
}

export async function getCommentsForSystemPosts(
  systemPostIds: string[],
  clanId: string,
): Promise<Record<string, CommentWithUser[]>> {
  const grouped: Record<string, CommentWithUser[]> = {};
  if (systemPostIds.length === 0) return grouped;

  const rows = await db
    .select({ comment: comments, user: users })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(inArray(comments.systemPostId, systemPostIds), eq(comments.clanId, clanId)))
    .orderBy(asc(comments.createdAt));

  for (const { comment, user } of rows) {
    if (!comment.systemPostId) continue; // narrows the column — always non-null for this query's own rows
    (grouped[comment.systemPostId] ??= []).push({
      id: comment.id,
      checkInId: comment.checkInId,
      systemPostId: comment.systemPostId,
      userId: comment.userId,
      text: comment.text,
      createdAt: comment.createdAt,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    });
  }
  return grouped;
}
