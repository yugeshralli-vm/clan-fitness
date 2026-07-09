import "server-only";

import { db } from "@/db";
import { notificationDeliveries } from "@/db/schema";

type Channel = "push" | "email";
type Status = "sent" | "failed" | "skipped";

/** Best-effort — a logging failure must never surface as a notification-send failure. */
export async function logNotificationDelivery(userId: string, channel: Channel, status: Status, detail?: string) {
  try {
    await db.insert(notificationDeliveries).values({ userId, channel, status, detail: detail?.slice(0, 500) });
  } catch (error) {
    console.error("Failed to record notification delivery log:", error);
  }
}
