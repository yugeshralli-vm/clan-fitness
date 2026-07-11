"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feedbackMessages } from "@/db/schema";
import { getAdminUserId, isAdminUser } from "@/features/admin";
import { notifyUser } from "@/features/notifications/send";
import { getFeedbackThread } from "./queries";
import { FEEDBACK_MESSAGE_MAX_LENGTH } from "./types";

export type FeedbackActionState = { error?: string; sent?: boolean } | undefined;

const NOTIFICATION_PREVIEW_LENGTH = 140;

function preview(body: string) {
  return body.length > NOTIFICATION_PREVIEW_LENGTH
    ? `${body.slice(0, NOTIFICATION_PREVIEW_LENGTH)}…`
    : body;
}

/** A thread's owner can always read/write it; anyone else needs to be the admin. */
async function resolveAccess(targetUserId: string) {
  const { userId: callerId } = await auth();
  if (!callerId) return { allowed: false as const };
  if (callerId === targetUserId) return { allowed: true as const, asAdmin: false };
  if (await isAdminUser()) return { allowed: true as const, asAdmin: true };
  return { allowed: false as const };
}

export async function sendFeedbackMessage(
  targetUserId: string,
  _prevState: FeedbackActionState,
  formData: FormData,
): Promise<FeedbackActionState> {
  const access = await resolveAccess(targetUserId);
  if (!access.allowed) return { error: "Not authorized." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message can't be empty." };
  if (body.length > FEEDBACK_MESSAGE_MAX_LENGTH) return { error: "Message is too long." };

  const sender = access.asAdmin ? "admin" : "user";
  await db.insert(feedbackMessages).values({ userId: targetUserId, sender, body });

  if (sender === "user") {
    const adminId = await getAdminUserId();
    if (adminId) {
      await notifyUser(adminId, {
        type: "feedback",
        title: "New feedback message",
        body: preview(body),
        url: `/admin/feedback/${targetUserId}`,
      });
    }
  } else {
    await notifyUser(targetUserId, {
      type: "feedback",
      title: "The Clan Fitness team replied",
      body: preview(body),
      url: "/feedback",
    });
  }

  revalidatePath(access.asAdmin ? `/admin/feedback/${targetUserId}` : "/feedback");
  return { sent: true };
}

/** Called directly from the client's polling loop, not through useActionState — same pattern as
 * PushNotificationManager's direct call to sendTestNotification(). */
export async function fetchFeedbackThread(targetUserId: string) {
  const access = await resolveAccess(targetUserId);
  if (!access.allowed) return [];
  return getFeedbackThread(targetUserId);
}
