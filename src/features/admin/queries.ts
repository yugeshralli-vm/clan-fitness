import "server-only";

import { count, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notificationDeliveries } from "@/db/schema";

export async function getNotificationDeliveryStats() {
  const [counts, recentFailures] = await Promise.all([
    db
      .select({
        channel: notificationDeliveries.channel,
        status: notificationDeliveries.status,
        count: count(),
      })
      .from(notificationDeliveries)
      .groupBy(notificationDeliveries.channel, notificationDeliveries.status),
    db
      .select()
      .from(notificationDeliveries)
      .where(inArray(notificationDeliveries.status, ["failed", "skipped"]))
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(20),
  ]);

  return { counts, recentFailures };
}
