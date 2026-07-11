import "server-only";

import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { broadcastMessages, clanMemberships, clans, notificationDeliveries, users } from "@/db/schema";

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

/** Every clan with its live member count, for the broadcast composer's clan picker — a single
 * query rather than one getClanMemberCount call per clan. */
export async function getAllClansForAdmin() {
  return db
    .select({ id: clans.id, name: clans.name, memberCount: count(clanMemberships.id) })
    .from(clans)
    .leftJoin(clanMemberships, eq(clanMemberships.clanId, clans.id))
    .groupBy(clans.id, clans.name)
    .orderBy(clans.name);
}

/** Every user, for the broadcast composer's user picker. */
export async function getAllUsersForAdmin() {
  return db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .orderBy(users.name);
}

export async function getBroadcastHistory() {
  return db.select().from(broadcastMessages).orderBy(desc(broadcastMessages.sentAt)).limit(20);
}
