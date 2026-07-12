import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
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
