"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { checkIns, comments } from "@/db/schema";
import { getClanMembers, getClanMembership } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { extractMentionedUserIds, mentionsToPlainText } from "./mentions";
import { COMMENT_MAX_LENGTH, COMMENT_MAX_RAW_LENGTH } from "./types";
import type { CommentWithUser } from "./queries";

export async function addComment(
  checkInId: string,
  clanId: string,
  text: string,
): Promise<{ comment: CommentWithUser } | { error: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!(await getClanMembership(user.id, clanId))) return { error: "Not a member of this clan." };

  const trimmed = text.trim();
  if (!trimmed) return { error: "Comment can't be empty." };
  if (trimmed.length > COMMENT_MAX_RAW_LENGTH) {
    return { error: "Comment is too long." };
  }
  const displayText = mentionsToPlainText(trimmed);
  if (displayText.length > COMMENT_MAX_LENGTH) {
    return { error: `Keep it under ${COMMENT_MAX_LENGTH} characters.` };
  }

  const [checkIn] = await db.select({ userId: checkIns.userId }).from(checkIns).where(eq(checkIns.id, checkInId));
  if (!checkIn) return { error: "Check-in not found." };

  const [row] = await db
    .insert(comments)
    .values({ checkInId, clanId, userId: user.id, text: trimmed })
    .returning();

  revalidatePath(`/clans/${clanId}`);

  // Mention targets must be members of this same clan — the commenter's own membership was
  // already verified above.
  const members = await getClanMembers(clanId);
  const memberIds = new Set(members.map((m) => m.user.id));
  const mentionedIds = new Set(extractMentionedUserIds(trimmed).filter((id) => memberIds.has(id) && id !== user.id));

  const recipients = new Map<string, { type: "comment" | "mention"; title: string; body: string }>();
  if (checkIn.userId !== user.id && !mentionedIds.has(checkIn.userId)) {
    recipients.set(checkIn.userId, {
      type: "comment",
      title: `${user.name} commented on your check-in`,
      body: displayText,
    });
  }
  for (const mentionedId of mentionedIds) {
    recipients.set(mentionedId, {
      type: "mention",
      title: `${user.name} mentioned you in a comment`,
      body: displayText,
    });
  }

  if (recipients.size > 0) {
    const url = `/clans/${clanId}`;
    after(() =>
      Promise.all([...recipients].map(([userId, payload]) => notifyUser(userId, { ...payload, url, checkInId }))),
    );
  }

  return {
    comment: {
      id: row.id,
      checkInId: row.checkInId,
      systemPostId: row.systemPostId,
      userId: row.userId,
      text: row.text,
      createdAt: row.createdAt,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    },
  };
}

/** Commenting on a system post (see src/features/system-posts) — simpler than addComment since
 * there's no check-in author to notify, but @mentions still work the same way. */
export async function addSystemPostComment(
  systemPostId: string,
  clanId: string,
  text: string,
): Promise<{ comment: CommentWithUser } | { error: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };
  if (!(await getClanMembership(user.id, clanId))) return { error: "Not a member of this clan." };

  const trimmed = text.trim();
  if (!trimmed) return { error: "Comment can't be empty." };
  if (trimmed.length > COMMENT_MAX_RAW_LENGTH) {
    return { error: "Comment is too long." };
  }
  const displayText = mentionsToPlainText(trimmed);
  if (displayText.length > COMMENT_MAX_LENGTH) {
    return { error: `Keep it under ${COMMENT_MAX_LENGTH} characters.` };
  }

  const [row] = await db
    .insert(comments)
    .values({ systemPostId, clanId, userId: user.id, text: trimmed })
    .returning();

  revalidatePath(`/clans/${clanId}`);

  // Mention targets must be members of this same clan — the commenter's own membership was
  // already verified above.
  const members = await getClanMembers(clanId);
  const memberIds = new Set(members.map((m) => m.user.id));
  const mentionedIds = new Set(extractMentionedUserIds(trimmed).filter((id) => memberIds.has(id) && id !== user.id));

  if (mentionedIds.size > 0) {
    const url = `/clans/${clanId}`;
    after(() =>
      Promise.all(
        [...mentionedIds].map((mentionedId) =>
          notifyUser(mentionedId, {
            type: "mention",
            title: `${user.name} mentioned you in a comment`,
            body: displayText,
            url,
          }),
        ),
      ),
    );
  }

  return {
    comment: {
      id: row.id,
      checkInId: row.checkInId,
      systemPostId: row.systemPostId,
      userId: row.userId,
      text: row.text,
      createdAt: row.createdAt,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    },
  };
}

export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const [existing] = await db
    .select({ userId: comments.userId, clanId: comments.clanId })
    .from(comments)
    .where(eq(comments.id, commentId));
  if (!existing) return { error: "Comment not found." };
  if (existing.userId !== user.id) return { error: "You can only delete your own comments." };

  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/clans/${existing.clanId}`);

  return {};
}
