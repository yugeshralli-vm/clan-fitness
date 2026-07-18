"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications, pushSubscriptions, users } from "@/db/schema";
import { getOrSyncCurrentUser } from "@/lib/current-user";
import { getNotificationsForUser } from "./queries";
import { sendTestPushNotification } from "./send";
import type { PushSubscriptionInput } from "./types";

export type NotificationPreferencesActionState = { error?: string } | undefined;

export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<{ error?: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });

  return {};
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ error?: string }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));

  return {};
}

export async function sendTestNotification(): Promise<{ error?: string; sent?: number }> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  const { sent } = await sendTestPushNotification(user.id);
  if (sent === 0) return { error: "No active push subscription found for this device." };
  return { sent };
}

/** Fetches recent notifications, then marks them all read — the returned rows still reflect who was unread before this call. */
export async function getNotificationsAndMarkRead() {
  const user = await getOrSyncCurrentUser();
  if (!user) return [];

  const items = await getNotificationsForUser(user.id);

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  return items;
}

export async function updateNotificationPreferences(
  _prevState: NotificationPreferencesActionState,
  formData: FormData,
): Promise<NotificationPreferencesActionState> {
  const user = await getOrSyncCurrentUser();
  if (!user) return { error: "Not signed in." };

  await db
    .update(users)
    .set({
      notifyOnComments: formData.get("notifyOnComments") === "on",
      notifyOnMentions: formData.get("notifyOnMentions") === "on",
      notifyOnReactions: formData.get("notifyOnReactions") === "on",
      notifyOnCheckIns: formData.get("notifyOnCheckIns") === "on",
    })
    .where(eq(users.id, user.id));

  revalidatePath("/profile");
}
