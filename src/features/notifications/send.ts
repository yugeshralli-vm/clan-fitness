import "server-only";

import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { notifications, pushSubscriptions, users } from "@/db/schema";
import { logNotificationDelivery } from "./delivery-log";
import { getPushSubscriptionsForUser, getUnreadNotificationCount } from "./queries";
import { sendEmailNotification } from "./send-email";
import type { NotificationPayload } from "./types";

let vapidConfigured = false;

/**
 * Configures web-push lazily, on first send, rather than at module load. VAPID env vars live
 * in per-environment config (not committed), so validating them at import time would fail the
 * build for every route that transitively imports this module, even ones that never send a push.
 */
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/** Sends a push notification to every device the user has subscribed on. Silently drops subscriptions the push service reports as gone. Returns how many sends succeeded. */
async function sendPushNotifications(
  userId: string,
  payload: NotificationPayload & { unreadCount?: number },
): Promise<number> {
  if (!ensureVapidConfigured()) {
    console.warn("Push notifications are not configured (missing VAPID env vars); skipping.");
    await logNotificationDelivery(userId, "push", "skipped", "VAPID env vars missing");
    return 0;
  }

  const subscriptions = await getPushSubscriptionsForUser(userId);
  if (subscriptions.length === 0) return 0; // no devices — not a delivery attempt worth logging

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { urgency: "high" },
        );
        await logNotificationDelivery(userId, "push", "sent");
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          await logNotificationDelivery(userId, "push", "failed", `${statusCode} Gone (subscription removed)`);
        } else {
          console.error("Failed to send push notification:", error);
          await logNotificationDelivery(userId, "push", "failed", (error as Error).message ?? String(error));
        }
      }
    }),
  );
  return sent;
}

/** Sends a one-off push straight to this user's devices, bypassing email/persistence — used by the "send test notification" button so people can confirm delivery without leaving a fake entry in their notification history. */
export async function sendTestPushNotification(userId: string): Promise<{ sent: number }> {
  const sent = await sendPushNotifications(userId, {
    type: "check_in",
    title: "Test notification",
    body: "If you can see this, push notifications are working on this device.",
  });
  return { sent };
}

async function persistNotification(userId: string, payload: NotificationPayload) {
  await db.insert(notifications).values({
    userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    checkInId: payload.checkInId,
  });
}

/**
 * Notifies a user through every channel available to them: push (if they have any subscribed
 * devices), email (if they have an address on file), and an in-app notification row (always).
 * All three run rather than one replacing another — push has had ongoing delivery issues, so
 * email is a backup channel and the in-app record is the durable source of truth either way.
 *
 * `skipEmail` opts a call out of the email channel — for a high-frequency source (clan chat)
 * where an email per message would be spammy, unlike the rare events every other caller sends.
 */
export async function notifyUser(
  userId: string,
  payload: NotificationPayload,
  options?: { skipEmail?: boolean },
) {
  const [[user], unreadBefore] = await Promise.all([
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)),
    getUnreadNotificationCount(userId),
  ]);
  // This call always inserts exactly one new unread notification below, so the post-send count
  // is knowable without waiting on persistNotification to finish — lets the service worker set an
  // accurate home-screen app badge (see sw.js's push handler) without adding to the send's latency.
  const unreadCount = unreadBefore + 1;

  await Promise.all([
    sendPushNotifications(userId, { ...payload, unreadCount }),
    user?.email && !options?.skipEmail ? sendEmailNotification(userId, user.email, payload) : Promise.resolve(),
    persistNotification(userId, payload),
  ]);
}
