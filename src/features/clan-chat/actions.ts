"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clanMessages } from "@/db/schema";
import { getClanMembers, getClanMembership } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { extractMentionedUserIds, MENTION_EVERYONE_ID, mentionsToPlainText } from "@/lib/mentions";
import { getClanMessages } from "./queries";
import { CLAN_MESSAGE_MAX_LENGTH, CLAN_MESSAGE_MAX_RAW_LENGTH } from "./types";

export type ClanChatActionState = { error?: string; sent?: boolean } | undefined;

const NOTIFICATION_PREVIEW_LENGTH = 140;

function preview(body: string) {
  return body.length > NOTIFICATION_PREVIEW_LENGTH
    ? `${body.slice(0, NOTIFICATION_PREVIEW_LENGTH)}…`
    : body;
}

/** Only a member of the clan can read/write its chat. */
async function resolveAccess(clanId: string) {
  const { userId } = await auth();
  if (!userId) return { allowed: false as const };
  const membership = await getClanMembership(userId, clanId);
  if (!membership) return { allowed: false as const };
  return { allowed: true as const, userId };
}

export async function sendClanMessage(
  clanId: string,
  _prevState: ClanChatActionState,
  formData: FormData,
): Promise<ClanChatActionState> {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return { error: "Not authorized." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message can't be empty." };
  if (body.length > CLAN_MESSAGE_MAX_RAW_LENGTH) return { error: "Message is too long." };
  const displayText = mentionsToPlainText(body);
  if (displayText.length > CLAN_MESSAGE_MAX_LENGTH) return { error: "Message is too long." };
  const rawReplyToMessageId = formData.get("replyToMessageId");
  let replyToMessageId: string | undefined;
  let replyToAuthorId: string | undefined;
  if (typeof rawReplyToMessageId === "string" && rawReplyToMessageId) {
    // A member of multiple clans could otherwise pass a message id from a *different* clan they're
    // also in, quoting its content into this clan's chat for members who aren't authorized to see
    // it — so the reply target has to be re-checked against this clanId, not just any valid id.
    const [target] = await db
      .select({ id: clanMessages.id, userId: clanMessages.userId })
      .from(clanMessages)
      .where(and(eq(clanMessages.id, rawReplyToMessageId), eq(clanMessages.clanId, clanId)))
      .limit(1);
    if (!target) return { error: "Invalid reply target." };
    replyToMessageId = rawReplyToMessageId;
    replyToAuthorId = target.userId;
  }

  await db.insert(clanMessages).values({ clanId, userId: access.userId, body, replyToMessageId });

  const members = await getClanMembers(clanId);
  const author = members.find((m) => m.user.id === access.userId);
  const memberIds = new Set(members.map((m) => m.user.id));
  const rawMentionedIds = extractMentionedUserIds(body);
  // @everyone broadcasts to the whole clan instead of naming individuals — its sentinel id isn't
  // a real member, so it'd otherwise just get silently dropped by the membership filter below.
  const mentionsEveryone = rawMentionedIds.includes(MENTION_EVERYONE_ID);
  const mentionedIds = new Set(
    mentionsEveryone
      ? [...memberIds].filter((id) => id !== access.userId)
      : rawMentionedIds.filter((id) => memberIds.has(id) && id !== access.userId),
  );
  const url = `/clans/${clanId}/chat`;

  // Only mentions and replies notify — chat used to ping every member on every message, which was
  // too noisy for an active clan; a reply to your own message is worth surfacing even if you
  // weren't @mentioned in it, but not if you were (avoid double-notifying the same message).
  await Promise.all(
    [...mentionedIds].map((userId) =>
      notifyUser(
        userId,
        {
          type: "mention",
          title: mentionsEveryone
            ? `${author?.user.name ?? "Someone"} mentioned everyone in clan chat`
            : `${author?.user.name ?? "Someone"} mentioned you in clan chat`,
          body: preview(displayText),
          url,
        },
        { skipEmail: true },
      ),
    ),
  );
  if (replyToAuthorId && replyToAuthorId !== access.userId && !mentionedIds.has(replyToAuthorId)) {
    await notifyUser(
      replyToAuthorId,
      { type: "reply", title: `${author?.user.name ?? "Someone"} replied to your message in clan chat`, body: preview(displayText), url },
      { skipEmail: true },
    );
  }

  revalidatePath(`/clans/${clanId}/chat`);
  return { sent: true };
}

/** Called directly from the client's polling loop, not through useActionState — same pattern the
 * old feedback chat used. */
export async function fetchClanMessages(clanId: string) {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return [];
  return getClanMessages(clanId, access.userId);
}
