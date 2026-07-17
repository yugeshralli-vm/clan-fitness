import "server-only";

import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clanMessages, users } from "@/db/schema";

export type ClanMessageRow = {
  id: string;
  clanId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: Date;
  replyToMessageId: string | null;
  replyToAuthorName: string | null;
  replyToBody: string | null;
};

const replyMessage = alias(clanMessages, "reply_message");
const replyAuthor = alias(users, "reply_author");

// Capped at the most recent 200, not truly unbounded — unlike the 1:1 feedback thread this
// replaced, a clan chat is many-to-many and can run for months with up to `maxSize` (default 15)
// active members. Live-joins `users` for the author's current name/avatar (same rationale as
// system-posts/queries.ts: users are never deleted in this app, so this stays correct even for a
// member who's since left the clan) rather than requiring a separate members lookup to render.
// The two left joins resolve a swipe-to-reply's quoted message + its author in the same
// round-trip — left, not inner, since replyToMessageId is nullable for most messages.
export async function getClanMessages(clanId: string): Promise<ClanMessageRow[]> {
  const rows = await db
    .select({
      id: clanMessages.id,
      clanId: clanMessages.clanId,
      userId: clanMessages.userId,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      body: clanMessages.body,
      createdAt: clanMessages.createdAt,
      replyToMessageId: clanMessages.replyToMessageId,
      replyToAuthorName: replyAuthor.name,
      replyToBody: replyMessage.body,
    })
    .from(clanMessages)
    .innerJoin(users, eq(clanMessages.userId, users.id))
    .leftJoin(replyMessage, eq(clanMessages.replyToMessageId, replyMessage.id))
    .leftJoin(replyAuthor, eq(replyMessage.userId, replyAuthor.id))
    .where(eq(clanMessages.clanId, clanId))
    .orderBy(desc(clanMessages.createdAt))
    .limit(200);

  return rows.reverse();
}

export async function getLatestClanMessageAt(clanId: string) {
  const [row] = await db
    .select({ createdAt: clanMessages.createdAt })
    .from(clanMessages)
    .where(eq(clanMessages.clanId, clanId))
    .orderBy(desc(clanMessages.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}
