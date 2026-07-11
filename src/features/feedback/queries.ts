import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feedbackMessages, users } from "@/db/schema";

export type FeedbackMessageRow = typeof feedbackMessages.$inferSelect;

export async function getFeedbackThread(userId: string) {
  return db
    .select()
    .from(feedbackMessages)
    .where(eq(feedbackMessages.userId, userId))
    .orderBy(feedbackMessages.createdAt);
}

export type FeedbackThreadSummary = {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: Date;
};

/** One row per user with at least one message, newest activity first. Reduced to one-per-user in
 * application code rather than a `DISTINCT ON` query — fine at beta scale, and simpler to also
 * carry the joined display name/avatar along without a second query. */
export async function getFeedbackThreadsForAdmin(): Promise<FeedbackThreadSummary[]> {
  const rows = await db
    .select({
      userId: feedbackMessages.userId,
      body: feedbackMessages.body,
      createdAt: feedbackMessages.createdAt,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(feedbackMessages)
    .innerJoin(users, eq(feedbackMessages.userId, users.id))
    .orderBy(desc(feedbackMessages.createdAt));

  const seen = new Set<string>();
  const summaries: FeedbackThreadSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    summaries.push({
      userId: row.userId,
      userName: row.userName,
      userAvatarUrl: row.userAvatarUrl,
      lastMessage: row.body,
      lastMessageAt: row.createdAt,
    });
  }
  return summaries;
}
