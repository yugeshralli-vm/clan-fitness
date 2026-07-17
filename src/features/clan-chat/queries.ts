import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { clanMessages, users } from "@/db/schema";
import { getReactionsForClanMessages } from "@/features/reactions/queries";
import type { ReactionSummary } from "@/features/reactions/types";

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
  reactionsSummary: ReactionSummary;
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
export async function getClanMessages(clanId: string, currentUserId: string): Promise<ClanMessageRow[]> {
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
    // Defense in depth alongside sendClanMessage's write-time check: a reply can only ever
    // resolve to a message in the same clan, never a foreign clan's row.
    .leftJoin(
      replyMessage,
      and(eq(clanMessages.replyToMessageId, replyMessage.id), eq(replyMessage.clanId, clanMessages.clanId)),
    )
    .leftJoin(replyAuthor, eq(replyMessage.userId, replyAuthor.id))
    .where(eq(clanMessages.clanId, clanId))
    .orderBy(desc(clanMessages.createdAt))
    .limit(200);

  // One extra batched query for the whole page, not one per message — same shape as
  // getReactionsForCheckIns — merged in here so it rides along on the existing 2s poll
  // (fetchClanMessages just re-calls this) instead of needing separate client-side plumbing.
  const reactionSummaries = await getReactionsForClanMessages(
    rows.map((row) => row.id),
    clanId,
    currentUserId,
  );

  return rows
    .map((row) => ({ ...row, reactionsSummary: reactionSummaries[row.id] ?? {} }))
    .reverse();
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
