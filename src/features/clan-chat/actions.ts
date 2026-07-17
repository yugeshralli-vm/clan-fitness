"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clanMessages } from "@/db/schema";
import { getClanMembers, getClanMembership } from "@/features/clans/queries";
import { notifyUser } from "@/features/notifications/send";
import { getClanMessages } from "./queries";
import { CLAN_MESSAGE_MAX_LENGTH } from "./types";

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
  if (body.length > CLAN_MESSAGE_MAX_LENGTH) return { error: "Message is too long." };

  await db.insert(clanMessages).values({ clanId, userId: access.userId, body });

  const members = await getClanMembers(clanId);
  const author = members.find((m) => m.user.id === access.userId);
  const recipientIds = members.map((m) => m.user.id).filter((id) => id !== access.userId);
  await Promise.all(
    recipientIds.map((userId) =>
      notifyUser(
        userId,
        {
          type: "clan_message",
          title: `${author?.user.name ?? "Someone"} in clan chat`,
          body: preview(body),
          url: `/clans/${clanId}/chat`,
        },
        { skipEmail: true },
      ),
    ),
  );

  revalidatePath(`/clans/${clanId}/chat`);
  return { sent: true };
}

/** Called directly from the client's polling loop, not through useActionState — same pattern the
 * old feedback chat used. */
export async function fetchClanMessages(clanId: string) {
  const access = await resolveAccess(clanId);
  if (!access.allowed) return [];
  return getClanMessages(clanId);
}
